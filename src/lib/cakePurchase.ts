import type { CakeKey } from '@/types'
import type { CakeDef } from './cakes'

interface CakeCheckout {
  addFood: (key: CakeKey) => Promise<boolean>
  spendCoins: (amount: number) => Promise<boolean>
  removeFood: (key: CakeKey) => Promise<boolean>
}

/** Save stock before charging; failed writes restore the optimistic food count. */
export async function purchaseCakeFood(cake: CakeDef, checkout: CakeCheckout): Promise<boolean> {
  const stocked = await checkout.addFood(cake.foodId)
  if (!stocked) {
    await checkout.removeFood(cake.foodId)
    return false
  }
  const paid = await checkout.spendCoins(cake.price)
  if (!paid) await checkout.removeFood(cake.foodId)
  return paid
}
