import type { CakeKey } from '@/types'
import type { CakeDef } from './cakes'
import { purchaseFridgeFood } from './foodPurchase'

interface CakeCheckout {
  addFood: (key: CakeKey) => Promise<boolean>
  spendCoins: (amount: number) => Promise<boolean>
  removeFood: (key: CakeKey) => Promise<boolean>
}

/** Save stock before charging. A failed stock write leaves the old pile alone. */
export async function purchaseCakeFood(cake: CakeDef, checkout: CakeCheckout): Promise<boolean> {
  return purchaseFridgeFood(cake.foodId, cake.price, {
    addFood: () => checkout.addFood(cake.foodId),
    removeFood: () => checkout.removeFood(cake.foodId),
    spendCoins: checkout.spendCoins,
  })
}
