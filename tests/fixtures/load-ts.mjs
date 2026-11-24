import fs from 'node:fs';
import ts from 'typescript';
export async function loadTS(path,replacements={}){let js=ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;for(const[from,to]of Object.entries(replacements))js=js.replaceAll(`from '${from}'`,`from ${JSON.stringify(to)}`);return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)}
export function tsURL(path){const js=ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`}
