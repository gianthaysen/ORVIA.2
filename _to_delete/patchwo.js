const fs=require('fs');const F='app/styles.css';let s=fs.readFileSync(F,'utf8');
const a=`.wo-cur-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
.wo-exname{font-size:17px;font-weight:800}
.wo-exact{display:flex;gap:10px}`;
const b=`/* v8-395 (Nutzerbefund 18.09.): Die Kopfzeile war ein starres flex mit space-between und
   ohne Umbruch. Auf dem Telefon brach ein langer Uebungsname ("Bankdruecken Smith Machine")
   auf drei Zeilen um, und die vier Aktionen daneben (Alternative · Superset · Ersetzen ·
   Entfernen) liefen rechts aus der Karte — "Entfernen" war nicht mehr erreichbar.
   Jetzt: Name und Aktionen duerfen umbrechen; unter 430 px bekommt der Name eine eigene
   Zeile und die Aktionen stehen vollstaendig darunter. */
.wo-cur-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.wo-exname{font-size:17px;font-weight:800;min-width:0;flex:1 1 auto;overflow-wrap:anywhere}
.wo-exact{display:flex;gap:10px;flex-wrap:wrap;row-gap:6px}
@media (max-width:430px){
  .wo-exname{flex:1 1 100%}
  .wo-exact{flex:1 1 100%;justify-content:flex-start}
}`;
if(s.indexOf(a)<0) throw new Error('nf'); fs.writeFileSync(F,s.replace(a,b)); console.log('ok');
