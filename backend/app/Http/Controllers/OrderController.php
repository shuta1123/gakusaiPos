<?php

namespace App\Http\Controllers;

use App\Events\OrderCancelled;
use App\Events\OrderCreated;
use App\Events\OrderStatusUpdated;
use App\Models\Counter;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
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
        $validated = $request->validate([
            'source' => ['required', Rule::in(array_keys(Order::SOURCE_RANGES))],
            // 会計画面のように「作成＝会計完了」を1リクエストで原子的に行うため、
            // 初期ステータスを任意指定できる（未指定は 注文完了）。
            'status' => ['sometimes', Rule::in(Order::STATUS_FLOW)],
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
                'number' => $this->allocateNumber($validated['source']),
                'source' => $validated['source'],
                'status' => $validated['status'] ?? '注文完了',
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

        // 終端「受け渡し完了」からの復帰は禁止。番号が解放・再利用された後に
        // 復帰すると同一番号がアクティブで二重に存在し得るため。
        if ($order->status === '受け渡し完了' && $validated['status'] !== '受け渡し完了') {
            return response()->json([
                'message' => '受け渡し完了の注文はステータスを戻せません',
            ], 422);
        }

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
     * 番号を割り当てる（消費）。会計1/会計2 それぞれ独立の XX(1〜50) 連番から、
     * その source で受け渡し完了していない使用中番号をスキップして次を返す。
     * （会計1と会計2で同じ XX が同時に出るのは許容する＝先頭の帯で区別できる。）
     * 必ず DB トランザクション内で呼ぶこと（カウンタ行をロックして直列化する）。
     */
    public function allocateNumber(string $source): int
    {
        $base = Order::SOURCE_RANGES[$source] ?? 0;
        $key = "order_seq:{$source}";

        // その source のカウンタ行をロックし、同時発番を直列化する。
        // 行が無い場合（手動削除等）に備え、作成してからロックし直す。
        $counter = Counter::where('key', $key)->lockForUpdate()->first();
        if (! $counter) {
            Counter::firstOrCreate(['key' => $key], ['value' => 0]);
            $counter = Counter::where('key', $key)->lockForUpdate()->first();
        }
        $current = $counter->value;

        $xx = $this->computeNextXx($current, $this->activeXx($source));
        if ($xx === null) {
            abort(409, "発番できる番号がありません（{$source}の1〜50が全て使用中です）");
        }

        $counter->value = $xx;
        $counter->save();

        return $base + $xx;
    }

    /**
     * 指定 source で現在アクティブ（受け渡し完了以外）な注文が占有している XX の集合。
     */
    private function activeXx(string $source): Collection
    {
        return Order::where('source', $source)
            ->whereIn('status', Order::ACTIVE_STATUSES)
            ->pluck('number')
            ->map(fn ($n) => $n % 100)
            ->flip();
    }

    /**
     * $current の次から 1〜50 を循環し、使用中でない最初の XX を返す。全て使用中なら null。
     */
    private function computeNextXx(int $current, Collection $activeXx): ?int
    {
        $xx = $current;
        for ($i = 0; $i < Order::XX_MAX; $i++) {
            $xx = ($xx % Order::XX_MAX) + 1; // 1..50 を循環（50の次は1）
            if (! $activeXx->has($xx)) {
                return $xx;
            }
        }

        return null;
    }

    /**
     * GET /api/orders/next-number 用のエンドポイント（消費しないプレビュー）。
     */
    public function nextNumberEndpoint(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source' => ['required', Rule::in(array_keys(Order::SOURCE_RANGES))],
        ]);

        $source = $validated['source'];
        $current = (int) (Counter::where('key', "order_seq:{$source}")->value('value') ?? 0);
        $xx = $this->computeNextXx($current, $this->activeXx($source));

        if ($xx === null) {
            return response()->json(['number' => null, 'message' => '空き番号がありません'], 409);
        }

        return response()->json(['number' => Order::SOURCE_RANGES[$source] + $xx]);
    }
}
