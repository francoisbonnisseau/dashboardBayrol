import{c as l,j as e,B as n}from"./index-D2OfrY1n.js";/**
 * @license lucide-react v0.515.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const o=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]],d=l("circle-alert",o);function x({title:t="Unable to load this section",description:s,onRetry:r,retrying:a=!1,variant:i="section",id:c}){return e.jsxs("div",{id:c,role:"alert",className:`ds-error ds-error-${i}`,children:[e.jsx(d,{"aria-hidden":"true",className:"size-4 shrink-0"}),e.jsxs("div",{className:"min-w-0",children:[e.jsx("p",{className:"font-medium",children:t}),s&&e.jsx("div",{className:"mt-1 text-sm text-muted-foreground",children:s}),r&&e.jsx(n,{type:"button",variant:"outline",size:"sm",className:"mt-3",disabled:a,onClick:r,children:a?"Retrying…":"Try again"})]})]})}export{d as C,x as E};
