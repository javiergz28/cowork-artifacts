'use strict';

// This file contains presentation logic only. The protected cycle HTML supplies DATA.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hasNumber=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const n=value=>hasNumber(value)?Number(value).toLocaleString('es-UY'):'Sin dato';
const money=value=>hasNumber(value)?(Number(value)<0?'−':'')+'$'+Math.abs(Number(value)).toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2}):'Sin dato';
const pct=value=>hasNumber(value)?Number(value).toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2})+'%':'No calculable';
const roas=value=>hasNumber(value)?Number(value).toLocaleString('es-UY',{minimumFractionDigits:2,maximumFractionDigits:2})+'×':'No aplica';
const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
const plainCopy=value=>String(value??'').replace(/\bCOGS\b/g,'costo de los productos').replace(/\bledger(?:\s+contable)?\b/gi,'registro contable').replace(/P&L/g,'resultado comercial').replace(/\bliquida\b/g,'informa');
const badge=(value,kind='mute')=>`<span class="pill p-${kind}">${esc(value||'Sin dato')}</span>`;
const sum=(rows,key)=>rows.reduce((total,row)=>total+(hasNumber(row[key])?Number(row[key]):0),0);
const signed=value=>hasNumber(value)?`<strong class="${value<0?'down':'up'}">${money(value)}</strong>`:'Sin dato';
const link=(url,label)=>/^https?:\/\//i.test(url||'')?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:esc(label);
const detailGrid=items=>`<dl class="detail-grid">${items.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${value??'Sin dato'}</dd></div>`).join('')}</dl>`;

function selectRows(rows,{query='',searchKeys=[],filters=[],sortKey,direction='desc'}){
  const words=fold(query).trim().split(/\s+/).filter(Boolean);
  const filtered=rows.filter(row=>{
    const hay=fold(searchKeys.map(key=>row[key]??'').join(' '));
    return words.every(word=>hay.includes(word))&&filters.every(filter=>!filter.value||String(filter.get(row)??'')===filter.value);
  });
  return filtered.slice().sort((a,b)=>{
    const av=a[sortKey],bv=b[sortKey];
    const aMissing=av===null||av===undefined||av==='',bMissing=bv===null||bv===undefined||bv==='';
    if(aMissing||bMissing)return aMissing===bMissing?0:aMissing?1:-1;
    const compared=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),'es',{numeric:true,sensitivity:'base'});
    return compared*(direction==='asc'?1:-1);
  });
}

function mountTable(cfg){
  const table=document.getElementById(cfg.table);
  if(!table)return;
  const wrapper=table.parentElement;
  let controls=document.getElementById(cfg.search)?.closest('.controls');
  if(!controls){
    controls=document.createElement('div');controls.className='controls';
    controls.innerHTML=`<label class="tag" for="${cfg.table}-search">Buscar</label><input type="search" id="${cfg.table}-search" placeholder="${esc(cfg.placeholder||'Buscar en esta tabla')}">`;
    wrapper.before(controls);cfg.search=cfg.table+'-search';
  }
  const search=document.getElementById(cfg.search);
  search.setAttribute('aria-controls',cfg.table);
  const filters=(cfg.filters||[]).map(filter=>{
    let select=document.getElementById(filter.id);
    if(!select){
      const label=document.createElement('label');label.className='tag';label.htmlFor=filter.id;label.textContent=filter.label;
      select=document.createElement('select');select.id=filter.id;select.add(new Option('Todos',''));controls.append(label,select);
    }
    select.setAttribute('aria-controls',cfg.table);
    const seen=new Set([...select.options].map(option=>option.value));
    [...new Set(cfg.rows.map(row=>String(filter.get(row)??'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).forEach(value=>{if(!seen.has(value))select.add(new Option(value,value));});
    return {...filter,select};
  });
  const reset=document.createElement('button');reset.type='button';reset.className='btn reset-filters';reset.textContent='Limpiar';reset.setAttribute('aria-label','Limpiar filtros de '+cfg.title);controls.append(reset);
  const tools=document.createElement('div');tools.className='table-tools';
  tools.innerHTML=`<div class="sort-controls"><label for="${cfg.table}-sort">Ordenar por</label><select id="${cfg.table}-sort">${cfg.columns.map(column=>`<option value="${esc(column.key)}">${esc(column.label)}</option>`).join('')}</select><button type="button" class="btn sort-direction" aria-label="Cambiar sentido del orden de ${esc(cfg.title)}"></button></div><p class="table-status" id="${cfg.table}-status" role="status" aria-live="polite" aria-atomic="true"></p>`;
  wrapper.before(tools);
  const footer=document.createElement('div');footer.className='table-footer';
  footer.innerHTML=`<div class="page-size"><label for="${cfg.table}-size">Filas por página</label><select id="${cfg.table}-size"><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></div><div class="pagination"><button type="button" class="btn prev" aria-label="Página anterior de ${esc(cfg.title)}">← Anterior</button><span class="page-label"></span><button type="button" class="btn next" aria-label="Página siguiente de ${esc(cfg.title)}">Siguiente →</button></div>`;
  wrapper.after(footer);
  const summary=document.createElement('p');summary.className='table-summary';summary.hidden=!cfg.summary;footer.after(summary);
  const sortSelect=tools.querySelector('select'),sortDirection=tools.querySelector('.sort-direction'),status=tools.querySelector('.table-status');
  const sizeSelect=footer.querySelector('select'),prev=footer.querySelector('.prev'),next=footer.querySelector('.next');
  let sortKey=cfg.sort||cfg.columns[0].key,direction=cfg.direction||'desc',page=1,pageSize=10,pageCount=1;
  const openDetails=new Set();
  table.className='data-table';table.setAttribute('aria-describedby',cfg.table+'-status');
  function render(){
    const focusedSort=table.contains(document.activeElement)?document.activeElement.dataset.sort:null;
    const rows=selectRows(cfg.rows,{query:search.value,searchKeys:cfg.searchKeys,filters:filters.map(filter=>({get:filter.get,value:filter.select.value})),sortKey,direction});
    pageCount=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,pageCount);
    const start=(page-1)*pageSize,visible=rows.slice(start,start+pageSize);
    sortSelect.value=sortKey;sortDirection.textContent=direction==='asc'?'↑ Ascendente':'↓ Descendente';
    status.textContent=rows.length?`${start+1}–${start+visible.length} de ${n(rows.length)} ${cfg.unit||'registros'} · total ${n(cfg.rows.length)}`:`Sin resultados · total ${n(cfg.rows.length)}`;
    table.innerHTML=`<caption class="table-caption">${esc(cfg.title)}. Usá los encabezados o el selector para ordenar. ${cfg.details?'El detalle amplía cada registro.':''}</caption><colgroup>${cfg.columns.map((column,index)=>`<col style="width:${column.width||(index===0?'36%':64/(cfg.columns.length-1)+'%')}">`).join('')}</colgroup><thead><tr>${cfg.columns.map(column=>`<th scope="col" class="${column.align||''}" aria-sort="${column.key===sortKey?(direction==='asc'?'ascending':'descending'):'none'}"><button type="button" data-sort="${esc(column.key)}" title="${esc(column.help||'Ordenar por '+column.label)}">${esc(column.label)}</button></th>`).join('')}</tr></thead><tbody>${visible.length?visible.map(row=>{
      const id=cfg.table+'-row-'+cfg.rows.indexOf(row),isOpen=openDetails.has(id);
      const cells=cfg.columns.map((column,index)=>`<td class="${column.align||''}" data-label="${esc(column.label)}">${column.format?column.format(row[column.key],row):esc(row[column.key]??'Sin dato')}${index===0&&cfg.details?`<button type="button" class="detail-button" aria-expanded="${isOpen}" aria-controls="${id}" aria-label="${isOpen?'Ocultar':'Ver'} detalle: ${esc(row[cfg.columns[0].key])}" data-detail="${id}">${isOpen?'Ocultar detalle −':'Ver detalle +'}</button>`:''}</td>`).join('');
      return `<tr>${cells}</tr>${cfg.details?`<tr class="detail-row" id="${id}" ${isOpen?'':'hidden'}><td colspan="${cfg.columns.length}">${cfg.details(row)}</td></tr>`:''}`;
    }).join(''):`<tr class="empty-row"><td colspan="${cfg.columns.length}" class="empty">No hay registros con esta búsqueda. Probá con menos palabras o limpiá los filtros.</td></tr>`}</tbody>`;
    table.querySelectorAll('[data-sort]').forEach(button=>button.addEventListener('click',()=>{if(sortKey===button.dataset.sort)direction=direction==='asc'?'desc':'asc';else{sortKey=button.dataset.sort;direction='desc';}page=1;render();}));
    table.querySelectorAll('[data-detail]').forEach(button=>button.addEventListener('click',()=>{
      const id=button.dataset.detail,opened=button.getAttribute('aria-expanded')!=='true';
      button.setAttribute('aria-expanded',String(opened));button.textContent=opened?'Ocultar detalle −':'Ver detalle +';button.setAttribute('aria-label',button.getAttribute('aria-label').replace(/^(Ver|Ocultar)/,opened?'Ocultar':'Ver'));document.getElementById(id).hidden=!opened;if(opened)openDetails.add(id);else openDetails.delete(id);
    }));
    prev.disabled=page<=1;next.disabled=page>=pageCount;footer.querySelector('.page-label').textContent=`Página ${page} de ${pageCount}`;
    if(cfg.summary)summary.innerHTML=rows.length?cfg.summary(rows):'No hay registros para resumir con estos filtros.';
    if(focusedSort)table.querySelector(`[data-sort="${focusedSort}"]`)?.focus({preventScroll:true});
  }
  const changeFilter=()=>{page=1;openDetails.clear();render();};
  search.addEventListener('input',changeFilter);filters.forEach(filter=>filter.select.addEventListener('change',changeFilter));
  reset.addEventListener('click',()=>{search.value='';filters.forEach(filter=>filter.select.value='');changeFilter();search.focus();});
  sortSelect.addEventListener('change',()=>{sortKey=sortSelect.value;page=1;render();});sortDirection.addEventListener('click',()=>{direction=direction==='asc'?'desc':'asc';page=1;render();});
  sizeSelect.addEventListener('change',()=>{pageSize=Number(sizeSelect.value);page=1;render();});
  prev.addEventListener('click',()=>{page=Math.max(1,page-1);render();});next.addEventListener('click',()=>{page=Math.min(pageCount,page+1);render();});
  render();
}

const noSalesWithSpend=DATA.ads.filter(row=>row.sales===0&&row.spend>0);
const alerts=DATA.alerts.filter(alert=>!fold(alert.title).includes('precios debajo')).map(alert=>fold(alert.title).includes('anuncios sin ventas')?{...alert,title:`${n(noSalesWithSpend.length)} anuncios con gasto y sin ventas atribuidas`,body:`Sumaron ${money(sum(noSalesWithSpend,'spend'))} en agosto. Revisá primero los de mayor gasto: publicación, precio y segmentación antes de mantener su presupuesto.`}:alert);
document.getElementById('alerts').innerHTML=alerts.map(alert=>`<article class="alert ${alert.level}"><h4>${esc(alert.title)}</h4><p>${esc(alert.body)}</p></article>`).join('');

const actionLinks={agencia:'#operacion',fichas:'#catalogo',anuncios:'#ads',devoluciones:'#resultado-agosto',calendario:'#conciliacion'};
document.getElementById('actions').innerHTML=DATA.actions.filter(action=>!fold(action.title).includes('precios')).map(action=>{
  const key=Object.keys(actionLinks).find(key=>fold(action.title).includes(key));
  const priority=action.priority==='Alta'?'Urgente':action.priority==='Media'?'Próximo paso':'Seguimiento';
  const why=fold(action.title).includes('anuncios')?`${n(noSalesWithSpend.length)} anuncios tuvieron gasto y ninguna venta atribuida: ${money(sum(noSalesWithSpend,'spend'))}.`:plainCopy(action.why);
  const done=fold(action.title).includes('agencia')?'Meta operativa propuesta: llegar al 90% a tiempo en la próxima semana. No es un umbral oficial de Mercado Libre.':fold(action.title).includes('anuncios')?'Cada anuncio tiene una decisión documentada y una fecha para revisar el resultado.':action.done;
  return `<article class="act ${action.priority==='Alta'?'alta':action.priority==='Media'?'media':'inv'}">${badge(priority,action.priority==='Alta'?'crit':action.priority==='Media'?'warn':'info')}<h4>${esc(action.title)}</h4><p class="why"><span class="k">Qué pasa</span><span>${esc(why)}</span></p><p class="done"><span class="k">Qué hacer</span><span>${esc(plainCopy(done))}</span></p>${key?`<a class="action-link" href="${actionLinks[key]}">Ver evidencia y detalle →</a>`:''}</article>`;
}).join('');

document.getElementById('channels').innerHTML=DATA.sales.channels.map(channel=>`<div class="metric-line"><span>${esc(channel.channel)}</span><b>${n(channel.shipments)}</b></div>`).join('');
const finance=DATA.sales.finance;
const bridge=[['Ingresos por productos','product_income'],['Cargo por venta','sale_fee'],['Costo fijo','fixed_fee'],['Ingresos por envío','shipping_income'],['Costos de envío','shipping_cost'],['Descuentos y bonificaciones','discounts'],['Anulaciones y reembolsos','refunds'],['Diferencia residual por conciliar','other_adjustments']];
if(finance.shipping_difference)bridge.push(['Diferencias de medidas / peso','shipping_difference']);
if(finance.taxes)bridge.push(['Impuestos informados','taxes']);
document.getElementById('ml-bridge').innerHTML=bridge.map(([label,key])=>`<div class="metric-line"><span>${esc(label)}</span><b>${finance[key]>0?'+':''}${money(finance[key])}</b></div>`).join('')+`<div class="metric-line total"><strong>Total informado por ML</strong><b>${money(finance.total)}</b></div>`;
document.getElementById('billing-groups').innerHTML='<div class="tw"><table id="billing-table"></table></div>';
mountTable({table:'billing-table',title:'Detalle de cargos contables',rows:DATA.billing.groups,sort:'value',placeholder:'Buscar tipo de cargo',searchKeys:['detail'],columns:[{key:'detail',label:'Tipo de cargo',width:'70%'},{key:'value',label:'Importe',align:'r',width:'30%',format:money}],summary:rows=>`Suma de los cargos filtrados: <strong>${money(sum(rows,'value'))}</strong>. El total de esta vista contable es ${money(DATA.billing.total)}; ya incluye anulaciones.`});

const chart=document.getElementById('daily-chart'),maxIncome=Math.max(...DATA.sales.daily.map(day=>day.income),1);
chart.innerHTML=DATA.sales.daily.map((day,index)=>`<button type="button" class="daybar ${day.income===0?'zero-day':''}" style="height:${Math.max(2,day.income/maxIncome*100)}%" aria-label="${esc(day.label)}: ${money(day.income)} de ingresos por productos" aria-pressed="false" data-i="${index}"><span>${index%5===0||index===30?day.label.slice(0,2):''}</span></button>`).join('');
chart.querySelectorAll('.daybar').forEach(button=>button.addEventListener('click',()=>{
  const day=DATA.sales.daily[Number(button.dataset.i)];document.getElementById('daily-select').value=button.dataset.i;chart.querySelectorAll('.daybar').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
  document.getElementById('daily-tip').textContent=`${day.label} · Ingresos ${money(day.income)} · Total ML ${money(day.net)} · ${n(day.units_gross)} unidades brutas · ${n(day.units_net)} operativas · ${n(day.shipments)} envíos${day.income===0?' · El export registra cero ingresos por productos ese día.':''}`;
}));
const dailySelect=document.getElementById('daily-select');
DATA.sales.daily.forEach((day,index)=>dailySelect.add(new Option(day.label,String(index))));
dailySelect.addEventListener('change',()=>{if(dailySelect.value!=='')chart.querySelector(`[data-i="${dailySelect.value}"]`)?.click();});

const productRows=DATA.sales.products;
mountTable({table:'product-table',title:'Resultado estimado por producto en agosto',search:'product-search',rows:productRows,sort:'income',unit:'productos',searchKeys:['sku','name','category','item','state'],filters:[{id:'product-filter',label:'Estado',get:row=>row.state},{id:'product-result',label:'Aporte',get:row=>!hasNumber(row.contribution)?'Sin dato':row.contribution<0?'Negativo':row.contribution===0?'Cero':'Positivo'}],columns:[
  {key:'name',label:'Producto',format:(value,row)=>`<div class="product-cell"><span class="name">${esc(value)}</span><span class="mono">${esc(row.sku)} · ${esc(row.category)}</span></div>`},
  {key:'units_net',label:'Unidades operativas',align:'r',help:'Unidades vendidas sin cancelaciones; mantiene devoluciones sin recuperación confirmada.',format:n},
  {key:'income',label:'Ingresos por productos',align:'r',help:'Ingreso del reporte; los paquetes se distribuyen según precio por unidades.',format:money},
  {key:'contribution',label:'Aporte estimado',align:'r',help:'Total ML asignado menos costo de las unidades y Ads asignados.',format:signed},
  {key:'margin',label:'Margen estimado',align:'r',help:'Aporte estimado dividido por ingresos del producto, multiplicado por 100.',format:pct}
],details:row=>detailGrid([
  ['Publicación vendida',link('https://articulo.mercadolibre.com.uy/MLU-'+String(row.item).replace(/\D/g,''),row.item)],
  ['Unidades brutas / canceladas',n(row.units_gross)+' / '+n(row.units_gross-row.units_net)],
  ['Unidades con devolución o reembolso',n(row.returns)],
  ['Costo unitario usado',money(row.cost_unit)],['Costo de las unidades',money(row.cogs)],['Total ML asignado',money(row.net_ml)],['Ads asignados',money(row.ads_spend)],
  ['Estado en el corte',badge(row.state,fold(row.state)==='activa'?'good':'mute')],['Calidad / experiencia',esc(row.quality)+' / '+esc(row.experience)]
])+`<p class="detail-note">Aporte: ${money(row.net_ml)} − ${money(row.cogs)} − ${money(row.ads_spend)} = <strong>${money(row.contribution)}</strong>. El costo usa el maestro del corte; puede diferir del costo al comprar. La publicación enlazada es la vendida, aunque el maestro apunte a otra. <a href="../rentabilidad/">Consultar precios y stock en Rentabilidad →</a></p>`,
summary:rows=>`<strong>Todo el resultado filtrado, no solo esta página:</strong> ${n(sum(rows,'units_net'))} unidades · ingresos ${money(sum(rows,'income'))} · aporte estimado ${money(sum(rows,'contribution'))} · margen ponderado ${sum(rows,'income')?pct(sum(rows,'contribution')/sum(rows,'income')*100):'No calculable'}. El total de cuenta descuenta también Ads no asignados; no sumes porcentajes.`});

const adsRows=DATA.ads.map(row=>({...row,roas:row.spend>0?row.income/row.spend:null,acos:row.income>0?row.spend/row.income*100:null}));
mountTable({table:'ads-table',title:'Publicidad por anuncio en agosto',search:'ads-search',rows:adsRows,sort:'spend',unit:'anuncios',searchKeys:['title','campaign','item','state'],filters:[{id:'ads-filter',label:'Estado',get:row=>row.state},{id:'ads-result',label:'Resultado',get:row=>row.spend===0?'Sin inversión':row.sales===0?'Con gasto, sin ventas':'Con ventas'}],columns:[
  {key:'title',label:'Anuncio',format:(value,row)=>`<div class="product-cell"><span class="name">${esc(value)}</span><span class="mono">${esc(row.campaign)}</span></div>`},
  {key:'spend',label:'Inversión',align:'r',format:money},{key:'income',label:'Ingresos atribuidos',align:'r',format:money},{key:'sales',label:'Ventas atribuidas',align:'r',format:n},{key:'roas',label:'ROAS',align:'r',format:roas}
],details:row=>detailGrid([['Publicación',link('https://articulo.mercadolibre.com.uy/MLU-'+String(row.item).replace(/\D/g,''),row.item)],['Estado del anuncio',esc(row.state)],['Impresiones / clics',n(row.impressions)+' / '+n(row.clicks)],['ACOS',pct(row.acos)],['Ventas directas / indirectas',n(row.sales_direct)+' / '+n(row.sales_indirect)],['Campaña',esc(row.campaign)]])+`<p class="detail-note">ROAS = ingresos atribuidos ÷ inversión. ACOS = inversión ÷ ingresos atribuidos × 100. Sin inversión, ROAS no aplica; sin ingresos, ACOS no se puede calcular. La atribución de ML puede incluir ventas indirectas; no equivale a ganancia.</p>`,summary:rows=>`<strong>Todo el resultado filtrado:</strong> inversión ${money(sum(rows,'spend'))} · ingresos atribuidos ${money(sum(rows,'income'))} · ${n(sum(rows,'sales'))} ventas atribuidas · ROAS ${sum(rows,'spend')?roas(sum(rows,'income')/sum(rows,'spend')):'No aplica'}. Estos ingresos ya forman parte de las ventas; no se suman otra vez.`});

mountTable({table:'promo-table',title:'Promociones',search:'promo-search',rows:DATA.promotions,sort:'gross',unit:'promociones',searchKeys:['name','validity','state'],filters:[{id:'promo-filter',label:'Estado',get:row=>row.state}],columns:[
  {key:'name',label:'Promoción',format:(value,row)=>`<div class="product-cell"><span class="name">${esc(value)}</span><span class="mono">${esc(row.validity)}</span></div>`},{key:'state',label:'Estado'},{key:'sales',label:'Ventas',align:'r',format:n},{key:'units',label:'Unidades',align:'r',format:n},{key:'gross',label:'Ventas brutas',align:'r',format:money}
],details:row=>detailGrid([['Vigencia exportada',esc(row.validity)],['Visitas',n(row.visits)],['Conversión informada',pct(row.conversion)]])+`<p class="detail-note">Las promociones pueden incluir las mismas ventas. No sumes filas para obtener el total de agosto. El estado corresponde al export del 01/09.</p>`,summary:rows=>`${n(rows.length)} promociones coinciden con los filtros. <strong>No se totalizan:</strong> sus ventas pueden solaparse.`});

mountTable({table:'coupon-table',title:'Cupones',rows:DATA.coupons,sort:'gross',unit:'cupones',placeholder:'Nombre, vigencia o descuento',searchKeys:['name','validity','state','discount'],filters:[{id:'coupon-filter',label:'Estado',get:row=>row.state}],columns:[
  {key:'name',label:'Cupón',format:(value,row)=>`<div class="product-cell"><span class="name">${esc(value)}</span><span class="mono">${esc(row.discount)} · ${esc(row.state)}</span></div>`},{key:'redeemed',label:'Canjeados',align:'r',format:n},{key:'units',label:'Unidades',align:'r',format:n},{key:'gross',label:'Ventas brutas',align:'r',format:money},{key:'cost',label:'Costo',align:'r',format:money}
],details:row=>detailGrid([['Vigencia exportada',esc(row.validity)],['Descuento',esc(row.discount)],['Estado exportado',esc(row.state)],['Aplicados',n(row.applied)]])+`<p class="detail-note">Aplicados y canjeados son campos distintos del export. El costo es el descuento informado para este cupón; no lo vuelvas a restar del resultado mensual sin conciliarlo.</p>`,summary:rows=>`${n(rows.length)} cupones coinciden. Estado del 01/09; revisá la vigencia de cada uno antes de interpretar sus resultados como ventas de agosto.`});

mountTable({table:'catalog-table',title:'Calidad de fichas de catálogo',search:'catalog-search',rows:DATA.catalog,sort:'units_sold',unit:'publicaciones',searchKeys:['sku','title','category','missing_fields','item'],filters:[{id:'catalog-filter',label:'Ventas',get:row=>row.units_sold>0?'Con ventas':'Sin ventas'},{id:'catalog-completion',label:'Ficha',get:row=>!hasNumber(row.missing)?'Sin dato':row.missing>0?'Con campos pendientes':'Completa'}],columns:[
  {key:'title',label:'Publicación',format:(value,row)=>`<div class="product-cell"><span class="name">${esc(value)}</span><span class="mono">${esc(row.sku||'Sin SKU')} · ${esc(row.category)}</span></div>`},{key:'units_sold',label:'Unidades vendidas',align:'r',format:n},{key:'income',label:'Ingresos',align:'r',format:money},{key:'completion',label:'Ficha completa',align:'r',format:pct},{key:'missing',label:'Campos pendientes',align:'r',format:n}
],details:row=>detailGrid([['Publicación',link('https://articulo.mercadolibre.com.uy/MLU-'+String(row.item).replace(/\D/g,''),row.item)],['Tipo',badge(row.catalog?'Catálogo':'Propia',row.catalog?'info':'mute')],['Atributos revisados',n(row.attributes)],['Campos prioritarios exportados',esc(row.missing_fields||'No se informan campos pendientes')]])+`<p class="detail-note">Completitud = (atributos revisados − pendientes) ÷ atributos revisados × 100. El listado de campos es un extracto: verificá la ficha completa en el archivo fuente. Primero atendé publicaciones con ventas y pendientes.</p>`,summary:rows=>`<strong>Todo el resultado filtrado:</strong> ${n(rows.length)} publicaciones · ${n(sum(rows,'missing'))} campos pendientes · ${n(rows.filter(row=>row.units_sold>0&&row.missing>0).length)} publicaciones vendidas con tareas pendientes.`});

mountTable({table:'source-table',title:'Archivos del cierre',search:'source-search',rows:DATA.sources,sort:'file',direction:'asc',unit:'archivos',searchKeys:['file','destination','period','status','note','sha'],filters:[{id:'source-filter',label:'Destino',get:row=>row.destination}],columns:[
  {key:'file',label:'Archivo',width:'43%',format:(value,row)=>`<div class="product-cell"><span class="name">${esc(value)}</span><span class="mono">${esc(row.period)}</span></div>`},{key:'destination',label:'Uso',width:'24%'},{key:'rows',label:'Filas',align:'r',width:'13%',format:n},{key:'status',label:'Estado',width:'20%'}
],details:row=>detailGrid([['Período o corte',esc(row.period)],['Huella de control (SHA, prefijo)',esc(row.sha)],['Cómo se utilizó',esc(plainCopy(row.note))]])+`<p class="detail-note">Filas describe la lectura de cada archivo; no equivale a ventas únicas y no se suma entre reportes.</p>`,summary:rows=>`${n(rows.length)} archivos coinciden con los filtros. Inventario original: ${n(DATA.sources.length)} archivos; el parcial y el duplicado siguen registrados como controles.`});

const notes=DATA.notes.map(note=>note.title==='Panel comercial privado'?{...note,title:'Alcance de este cierre',body:'El cierre conserva las cifras de agosto y la fecha de cada fuente. Los precios y stock para decidir se consultan en el panel independiente de Rentabilidad. Esta actualización mejora la lectura; no importa nuevas ventas ni actualiza el maestro.'}:note);
const unassignedAds=DATA.ads_totals.spend-sum(productRows,'ads_spend');
const roundingAdjustment=DATA.profit.contribution-(sum(productRows,'contribution')-unassignedAds);
notes.push({level:'warn',title:'El aporte por SKU no suma el resultado de la cuenta',body:`Los SKU suman ${money(sum(productRows,'contribution'))}. Falta descontar ${money(unassignedAds)} de Ads sin asignación a ventas del mes y aplicar un ajuste de ${money(roundingAdjustment)} por redondeo: así se llega a ${money(DATA.profit.contribution)}. No se fuerza ese gasto sobre un SKU.`});
notes.push({level:'warn',title:'Importes pendientes de conciliación',body:`El puente conserva un ajuste residual de ${money(DATA.sales.finance.other_adjustments)} para llegar al Total del reporte. Es una diferencia matemática pendiente de explicar; no es un tipo de cargo verificado. La contribución todavía no descuenta gastos operativos fuera de los reportes.`});
document.getElementById('note-count').textContent=notes.length+' notas y controles';
document.getElementById('notes').innerHTML=notes.map(note=>`<details class="q ${note.level}"><summary>${esc(plainCopy(note.title))}<span class="tagline">${note.level==='ok'?'verificado':'alcance / revisión'}</span></summary><div class="body"><p>${esc(plainCopy(note.body))}</p></div></details>`).join('');

// Retain links made before the historical result was renamed.
if(location.hash==='#rentabilidad')document.getElementById('resultado-agosto')?.scrollIntoView();
