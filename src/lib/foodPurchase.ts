import type { FoodKey } from '@/types'

export interface FoodCheckout {
  addFood: (key: FoodKey) => Promise<boolean>
  spendCoins: (amount: number) => Promise<boolean>
  removeFood: (key: FoodKey) => Promise<boolean>
}

/** Fridge helpers expose saved stock only; a failed grant must never be charged. */
export async function purchaseFridgeFood(key: FoodKey, price: number, checkout: FoodCheckout): Promise<boolean> {
  if (!(await checkout.addFood(key))) return false
  if (await checkout.spendCoins(price)) return true
  await checkout.removeFood(key)
  return false
}
