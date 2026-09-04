<?php

namespace App\Http\Controllers;

use App\Events\OrderCancelled;
use App\Events\OrderCreated;
use App\Events\OrderStatusUpdated;
use App\Models\Order;
use App\Models\Product;
use App\Support\StaffToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    /**
     * 注文一覧。status で絞り込み可能。
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['sometimes', Rule::in(Order::STATUS_FLOW)],
            'source' => ['sometimes', Rule::in(array_keys(Order::SOURCE_RANGES))],
        ]);

        $orders = Order::with('items.product')
            ->when($validated['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($validated['source'] ?? null, fn ($q, $source) => $q->where('source', $source))
            ->orderBy('id')
            ->get();

        return response()->json($orders);
    }

    /**
     * 注文作成。
     */
    public function store(Request $request): JsonResponse
    {
        // 公開エンドポイント（客用）はモバイル注文のみ許可。会計1/会計2 の発番は
        // スタッフトークンを持つ場合のみ（会計画面フェーズで使用）。
        $isStaff = StaffToken::verify($request->bearerToken());
        $allowedSources = $isStaff ? array_keys(Order::SOURCE_RANGES) : ['モバイル'];

        $validated = $request->validate([
            'source' => ['required', Rule::in($allowedSources)],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ]);

        // 注文時点の商品を取得し、売り切れチェックと単価スナップショットに使う。
        $products = Product::whereIn('id', collect($validated['items'])->pluck('product_id'))
            ->get()
            ->keyBy('id');

        $soldOut = $products->firstWhere('is_sold_out', true);
        if ($soldOut) {
            return response()->json([
                'message' => "「{$soldOut->name}」は売り切れです",
            ], 422);
        }

        $order = DB::transaction(function () use ($validated, $products) {
            $order = Order::create([
                'number' => $this->nextNumber($validated['source']),
                'source' => $validated['source'],
                'status' => '注文完了',
            ]);

            foreach ($validated['items'] as $item) {
                $order->items()->create([
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    // 注文時点の価格をスナップショット保存
                    'unit_price' => $products[$item['product_id']]->price,
                ]);
            }

            return $order;
        });

        $order->load('items.product');
        broadcast(new OrderCreated($order))->toOthers();

        return response()->json($order, 201);
    }

    /**
     * 注文詳細。
     */
    public function show(Order $order): JsonResponse
    {
        return response()->json($order->load('items.product'));
    }

    /**
     * ステータス更新。
     */
    public function updateStatus(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(Order::STATUS_FLOW)],
        ]);

        $order->update(['status' => $validated['status']]);
        $order->load('items.product');

        broadcast(new OrderStatusUpdated($order))->toOthers();

        return response()->json($order);
    }

    /**
     * 注文キャンセル（削除）。
     */
    public function destroy(Order $order): JsonResponse
    {
        $id = $order->id;
        $number = $order->number;
        $order->delete();

        broadcast(new OrderCancelled($id, $number))->toOthers();

        return response()->json(['message' => 'キャンセルしました']);
    }

    /**
     * 指定 source の次の注文番号を返す。
     */
    public function nextNumber(string $source): int
    {
        $base = Order::SOURCE_RANGES[$source] ?? 0;

        $last = Order::where('source', $source)
            ->orderByDesc('id')
            ->value('number');

        if ($last === null) {
            return $base;
        }

        // 末尾2桁を 00〜99 で循環させる。
        return $base + (($last - $base + 1) % 100 + 100) % 100;
    }

    /**
     * GET /api/orders/next-number 用のエンドポイント。
     */
    public function nextNumberEndpoint(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source' => ['required', Rule::in(array_keys(Order::SOURCE_RANGES))],
        ]);

        return response()->json(['number' => $this->nextNumber($validated['source'])]);
    }
}
