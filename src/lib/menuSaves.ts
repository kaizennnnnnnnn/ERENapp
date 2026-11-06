import type { ErenStats } from '@/types'
import type { createClient } from './supabase/client'
import { pendingSavedRpcs, savedRpc } from './savedRpc'

export const MENU_RPC='claim_menu_bonus_atomic'
export type MenuState=NonNullable<ErenStats['menu_state']>
export interface MenuSaveResult {
  ok:boolean;reason?:string;day?:string;user_id?:string;household_id?:string
  coins?:number;menu_state?:MenuState;awarded?:number;claimed_by?:string|null
}
const flights=new Map<string,Promise<MenuSaveResult>>()
export function hasPendingMenu(userId:string,householdId:string){
  return pendingSavedRpcs(userId,MENU_RPC).some(r=>r.slot===householdId&&r.args.p_household_id===householdId)
}
export function saveMenu(client:ReturnType<typeof createClient>,userId:string,householdId:string,day:string):Promise<MenuSaveResult>{
  const key=`${userId}:${householdId}`,existing=flights.get(key)
  if(existing)return existing
  const request=(async()=>{
    try{return await savedRpc<MenuSaveResult>(client,userId,MENU_RPC,householdId,{
      p_expected_user:userId,p_household_id:householdId,p_day:day,
      p_time_zone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',
    })}catch{return {ok:false,reason:'connection'}}
  })()
  flights.set(key,request)
  return request.finally(()=>{if(flights.get(key)===request)flights.delete(key)})
}
export function menuSaveError(reason?:string){
  if(reason==='not_ready')return 'Menu saving is waiting for an update.'
  if(reason==='household_changed'||reason==='session_changed')return 'Your account or household changed. Reopen the menu.'
  if(reason==='period_changed')return 'The menu day changed. Please retry.'
  return 'Could not confirm the menu bonus. Retry to recover it.'
}
