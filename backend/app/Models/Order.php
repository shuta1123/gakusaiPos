<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    use HasFactory;

    /** 注文番号の帯（source => 百の位）。末尾2桁は 00〜99 で循環する。 */
    public const SOURCE_RANGES = [
        '会計1' => 100,
        '会計2' => 200,
        'モバイル' => 700,
    ];

    /** ステータス遷移順。 */
    public const STATUS_FLOW = [
        '注文完了',
        '会計完了',
        '準備完了',
        '受け渡し完了',
    ];

    protected $fillable = [
        'number',
        'source',
        'status',
    ];

    protected $casts = [
        'number' => 'integer',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }
}
