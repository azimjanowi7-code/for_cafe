// Planning inputs, not observed billing. Override rates only after checking Delhi SKUs.
export function estimateSmallCafe({days=30,ordersPerDay=100,paidSessionsPerDay=50,staffTabs=6,activeHours=10,probeSeconds=5,qrVisitsPerDay=250,visibleMenuItems=50,qrMiBPerVisit=2,readsPerRebuild=200,readUsdPer100k=0.03,writeUsdPer100k=0.09}={}){
 const rebuildsPerDay=4*ordersPerDay+ordersPerDay+2*paidSessionsPerDay;
 const healthPerDay=staffTabs*activeHours*3600/probeSeconds;
 const readsPerDay=Math.ceil(rebuildsPerDay*readsPerRebuild+healthPerDay+qrVisitsPerDay*(visibleMenuItems+1)+5000);
 const writesPerDay=Math.ceil(rebuildsPerDay*(staffTabs+1)+ordersPerDay*10+paidSessionsPerDay*3);
 const readsAfterFree=Math.max(0,readsPerDay-50000)*days,writesAfterFree=Math.max(0,writesPerDay-20000)*days;
 const hostingGBPerDay=qrVisitsPerDay*qrMiBPerVisit*1024*1024/1e9;
 return {assumptions:{days,ordersPerDay,paidSessionsPerDay,staffTabs,activeHours,probeSeconds,qrVisitsPerDay,visibleMenuItems,qrMiBPerVisit,readsPerRebuild,readUsdPer100k,writeUsdPer100k},rebuildsPerDay,healthInvocationsPerMonth:healthPerDay*days,readsPerDay,writesPerDay,monthlyFirestoreOperationsIllustrationUSD:Number((readsAfterFree/100000*readUsdPer100k+writesAfterFree/100000*writeUsdPer100k).toFixed(2)),monthlyHostingTransferIllustrationUSD:Number((Math.max(0,hostingGBPerDay-0.36)*days*0.15).toFixed(2)),expectedPlanningRangeUSD:[5,25],suggestedProductionAlertBudgetUSD:40,suggestedStagingAlertBudgetUSD:10,notIncluded:['taxes/exchange rate/domain registration','existing shared-quota use','actual Delhi SKU confirmation','large image payloads','extended test/recompute traffic','SMS or paid third-party services','storage/PITR/backup/restore/build/registry/CPU costs not in the two illustrative operation formulas'],measured:false};
}
