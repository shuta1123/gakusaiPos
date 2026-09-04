<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    use HasFactory;

    /** 注文番号の帯（source => 百の位）。末尾2桁 XX は会計1/会計2それぞれ独立。 */
    public const SOURCE_RANGES = [
        '会計1' => 100,
        '会計2' => 200,
    ];

    /** 末尾2桁 XX の範囲（各レジ独立で 1〜50 を循環）。 */
    public const XX_MIN = 1;
    public const XX_MAX = 50;

    /** 番号を占有し続けるステータス（受け渡し完了になれば解放）。 */
    public const ACTIVE_STATUSES = ['注文完了', '会計完了', '準備完了'];

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
