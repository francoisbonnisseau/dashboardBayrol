import{c as a,j as s}from"./index-D2OfrY1n.js";import{g as i,a as c,b as r,S as l,c as d,M as m,d as x}from"./StructuredResponseContent-BfTTphbU.js";/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16 14",key:"68esgv"}]],j=a("clock",u);/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=[["path",{d:"m18 16 4-4-4-4",key:"1inbqp"}],["path",{d:"m6 8-4 4 4 4",key:"15zrgr"}],["path",{d:"m14.5 4-5 16",key:"e7oirm"}]],g=a("code-xml",p);function k(t,n){const e=t instanceof Error?t.message:"",o=e.toLowerCase();return o.includes("token is invalid")||o.includes("invalid token")||o.includes("unauthorized")||o.includes("status code 401")?"Unable to connect to Botpress. Please check configuration.":e||n}function y({payload:t}){const n=i(t),e=c(t);return s.jsxs(s.Fragment,{children:[(e==null?void 0:e.kind)==="step_list"&&s.jsx(l,{steps:e.steps||[],title:e.title}),(e==null?void 0:e.kind)==="sources"&&s.jsx(d,{items:e.items||[],title:e.title}),!e&&n&&s.jsx(m,{text:n}),!e&&!n&&s.jsxs("div",{className:"space-y-1",children:[s.jsx("div",{className:"text-sm font-medium text-foreground",children:x(t)}),s.jsx("p",{className:"text-xs text-muted-foreground",children:"This message contains structured data. Expand the payload to inspect it."})]}),r(t)&&s.jsxs("details",{className:"mt-3 border-t border-current/10 pt-2",children:[s.jsxs("summary",{className:"flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900",children:[s.jsx(g,{className:"h-3.5 w-3.5"}),"View full payload"]}),s.jsx("pre",{className:"mt-2 max-h-56 overflow-auto rounded-md bg-slate-800 p-3 text-xs leading-5 text-slate-100",children:JSON.stringify(t,null,2)})]})]})}export{j as C,y as M,k as f};
