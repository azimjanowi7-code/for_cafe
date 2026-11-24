import type {ComponentType} from 'react';
import type {Language} from './model';
import type {StaffSession} from './firebase/staffAuth';
export type ReportingProps={identity:StaffSession;language:Language;now:number};
export type ReportingViews={Reports:ComponentType<ReportingProps&{onMenu:()=>void}>;WaiterStats:ComponentType<ReportingProps&{onTables:()=>void}>;KitchenStats:ComponentType<ReportingProps&{compact?:boolean}>};
