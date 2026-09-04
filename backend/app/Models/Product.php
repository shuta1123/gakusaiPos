<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'price',
        'is_sold_out',
    ];

    protected $casts = [
        'price' => 'integer',
        'is_sold_out' => 'boolean',
    ];
}
