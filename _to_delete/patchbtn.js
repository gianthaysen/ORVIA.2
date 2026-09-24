const fs=require('fs');const F='app/styles.css';let s=fs.readFileSync(F,'utf8');
const a = `/* ---- v5-Farbsprache: dunkler Text auf Goldflächen (Prototyp-Treue + Kontrast) ---- */
.segs button.on{color:#20180a}
.btn:not(.sec):not(.gline){color:#20180a}
.btn:not(.sec):not(.gline) .cta-sub{color:rgba(32,24,10,.65)}`;
const b = `/* ---- v5-Farbsprache: dunkler Text auf Goldflächen (Prototyp-Treue + Kontrast) ----
   v8-395 (Nutzerbefund 18.09.): Die pauschale Regel .btn:not(.sec):not(.gline){color:#20180a}
   stammt aus der Zeit, als .btn eine GEFÜLLTE Goldfläche war — dort ist fast schwarze Schrift
   richtig. Eine spätere Überarbeitung machte .btn zum durchscheinenden Gold auf dunklem Grund
   (linear-gradient rgba(201,174,124,.15) → .055) mit hellem Label (#E9DCBE). Die Farbregel
   stand aber weiter unten in der Datei und gewann: fast schwarze Schrift auf fast schwarzem
   Grund — gemessen #20180a auf rgba(201,174,124,.055). Betroffen waren alle großen Buttons
   der App, u. a. „Übung hinzufügen" im leeren Live-Workout.
   Die wirklich goldgefüllten Flächen setzen ihre dunkle Schrift selbst (.cta.prim,
   .sheet-cta .prim, .gm-story .wst-cta button.prim, .fab, .segs button.on) — die pauschale
   Regel wird deshalb ersatzlos entfernt, statt sie mit einer weiteren Ausnahme zu flicken. */
.segs button.on{color:#20180a}
.cta-sub{color:var(--muted)}`;
if(s.indexOf(a)<0) throw new Error('nf'); fs.writeFileSync(F, s.replace(a,b)); console.log('ok');
