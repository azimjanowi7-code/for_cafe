import {useEffect,useState} from 'react';
export const MOTION={press:100,micro:150,standard:200,sheet:250,timer:300,highlight:2000,undo:5000,loading:300} as const;
export function useReducedMotion(){const[reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(media.matches);media.addEventListener('change',update);update();return()=>media.removeEventListener('change',update)},[]);return reduced}
