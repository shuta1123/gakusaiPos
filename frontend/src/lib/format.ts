/** 数値を「¥1,234」形式に整形する。 */
export function formatYen(amount: number): string {
  return `¥${Math.round(amount).toLocaleString("ja-JP")}`;
}
