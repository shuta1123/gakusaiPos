<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Http\JsonResponse;

class StatsController extends Controller
{
    /**
     * 売上集計。キャンセル注文は除外する。
     * - total_sales:    売上合計（各注文の 小計−割引 の合計）
     * - order_count:    注文数
     * - total_discount: 割引の合計
     * - by_source:      レジ別（会計1/会計2）の 件数・売上
     * - by_product:     商品別の 販売数・売上（売上は割引前の各商品小計の合計）
     */
    public function summary(): JsonResponse
    {
        $orders = Order::with('items.product')
            ->where('status', '!=', Order::STATUS_CANCELLED)
            ->get();

        $totalSales = 0;
        $totalDiscount = 0;
        $bySource = [];
        foreach (array_keys(Order::SOURCE_RANGES) as $s) {
            $bySource[$s] = ['count' => 0, 'sales' => 0];
        }
        $byProduct = [];

        foreach ($orders as $order) {
            $lineTotal = $order->items->sum(fn ($i) => $i->unit_price * $i->quantity);
            $orderSales = max(0, $lineTotal - $order->discount);

            $totalSales += $orderSales;
            $totalDiscount += $order->discount;

            if (isset($bySource[$order->source])) {
                $bySource[$order->source]['count']++;
                $bySource[$order->source]['sales'] += $orderSales;
            }

            foreach ($order->items as $item) {
                $pid = $item->product_id;
                if (! isset($byProduct[$pid])) {
                    $byProduct[$pid] = [
                        'name' => $item->product?->name ?? "#{$pid}",
                        'units' => 0,
                        'sales' => 0,
                    ];
                }
                $byProduct[$pid]['units'] += $item->quantity;
                $byProduct[$pid]['sales'] += $item->unit_price * $item->quantity;
            }
        }

        // 販売数の多い順に並べる。
        $byProductSorted = collect($byProduct)
            ->sortByDesc('units')
            ->values()
            ->all();

        return response()->json([
            'total_sales' => $totalSales,
            'order_count' => $orders->count(),
            'total_discount' => $totalDiscount,
            'by_source' => $bySource,
            'by_product' => $byProductSorted,
        ]);
    }
}
