from pathlib import Path
from html import escape as E
import json
root=Path(__file__).resolve().parents[1]
groups=[
('eisbecher','Eisbecher','Klassiker & besondere Kreationen','fruechte-becher',[
('Amarena-Becher','amarena-becher'),('Erdbeer-Becher','erdbeer-becher'),('Früchte-Becher','fruechte-becher'),('Ananas-Becher','ananas-becher'),('Banana Split','banana-split'),('Melonen-Becher','melonen-becher'),('After-Eight-Becher','after-eight-becher'),('Raffaello-Becher','raffaello-becher'),('Roche-Becher','roche-becher'),('Mocca-Becher','mocca-becher'),('Nusstraum-Becher','nusstraum-becher'),('Köllerbacher Becher','koellerbacher-becher'),('Tartufo-Becher','tartufo-becher')]),
('spaghetti-eisbecher','Spaghetti-Eisbecher','Sechs Variationen unseres Klassikers','spaghetti-classic',[
('Spaghetti Classic','spaghetti-classic'),('Spaghetti Erdbeere','spaghetti-erdbeere'),('Spaghetti Amarena','spaghetti-amarena'),('Spaghetti Carbonara','spaghetti-carbonara'),('Spaghetti Melone','spaghetti-melone'),('Spaghetti Neri','spaghetti-neri')]),
('joghurtbecher','Joghurtbecher','Fruchtig, frisch & cremig','joghurt-fruechte',[
('Joghurt Kiwi','joghurt-kiwi'),('Joghurt Mango','joghurt-mango'),('Joghurt Italia','joghurt-italia'),('Joghurt Früchte','joghurt-fruechte'),('Joghurt Waldbeer','joghurt-waldbeer'),('Joghurt Banane','joghurt-banane')]),
('kinderbecher','Kinderbecher','Für unsere kleinen Gäste','kinder-spaghetti',[
('Smarties-Becher','smarties-becher'),('Micky Mouse','micky-mouse'),('Biene Maja','biene-maja'),('Gummibären-Becher','gummibaeren-becher'),('Schneemann','schneemann-becher'),('Kinder Spaghetti','kinder-spaghetti')])
]
files=[slug+'.webp' for g in groups for _,slug in g[4]]
assets=root/'assets/images/cups'
assert len(files)==len(set(files))==31 and set(files)=={x.name for x in assets.glob('*.webp')}
for f in files:assert (assets/f).stat().st_size>10000,f
catalog=[dict(id=id,title=title,subtitle=desc,cover=cover+'.webp',products=[dict(name=n,image=slug+'.webp')for n,slug in items]) for id,title,desc,cover,items in groups]
(root/'data/cups-v111.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
def pic(slug,alt,load='lazy',cls=''):
 return f'<img class="{cls}" src="/assets/images/cups/{E(slug)}.webp" width="1254" height="1254" loading="{load}" decoding="async" alt="{E(alt)}">'
def tab(g,i):
 id,title,desc,cover,items=g
 label='<span>Kinderbecher</span><small>Für unsere kleinen Gäste</small>' if id=='kinderbecher' else E(title)
 return f'''<a class="cups111-choice" id="tab-{id}" href="#{id}" data-cups-category="{id}" aria-controls="{id}">
 <span class="cups111-choice__copy"><span class="cups111-choice__index">0{i} / 04</span><strong>{label}</strong><span class="cups111-choice__count">{len(items)} Kreationen <span aria-hidden="true">↗</span></span></span>
 {pic(cover,'',cls='cups111-choice__image')}</a>'''
def panel(g,i):
 id,title,desc,cover,items=g
 cards=[]
 for k,(name,slug) in enumerate(items,1):
  cards.append(f'''<figure class="cups111-product"><div class="cups111-product__photo">
  {pic(slug,name+' von Gelato Donatello','eager' if id=='eisbecher' and k<=4 else 'lazy')}
  </div><figcaption class="cups111-product__caption"><span class="cups111-product__number">{k:02}</span><h3>{E(name)}</h3></figcaption></figure>''')
 return f'''<section class="cups111-panel" id="{id}" data-cups-panel="{id}" aria-labelledby="tab-{id}" tabindex="-1">
 <div class="cups111-panel__head"><div><p class="cups111-eyebrow">UNSERE EISWELT <span> / 0{i}</span></p>
 <h2>{E(title)}</h2><p class="cups111-panel__subtitle">{E(desc)}</p></div>
 <span class="cups111-panel__quantity">{len(items):02} <small>Kreationen</small></span></div>
 <div class="cups111-products">{''.join(cards)}</div></section>'''
tabs=''.join(tab(g,i)for i,g in enumerate(groups,1))
panels=''.join(panel(g,i)for i,g in enumerate(groups,1))
html=f'''<!DOCTYPE html><html lang="de"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unsere Eisbecher & Eiswelten | Gelato Donatello</title>
<meta name="description" content="Entdecke die Eisbecher von Gelato Donatello: Klassiker, Spaghetti-Eis, Joghurtbecher und Kreationen für unsere kleinen Gäste.">
<meta name="robots" content="noindex,nofollow,noarchive">
<link rel="stylesheet" href="/assets/css/style.css"><link rel="stylesheet" href="/assets/css/cups-v111.css"></head>
<body data-page="eisbecher"><a class="skip-link" href="#main">Zum Inhalt springen</a><div id="site-header"></div><main id="main" class="cups111">
<section class="cups111-hero" aria-labelledby="cups111-title"><div class="cups111-hero__inner">
<div class="cups111-hero__text"><p class="cups111-eyebrow">GELATO DONATELLO <span> / UNSERE EISWELT</span></p>
<h1 id="cups111-title">Einfach zum <em>Verlieben.</em></h1>
<p>Dein Lieblingsbecher wartet schon. Entdecke unsere Eiswelt, ganz nach deinem Geschmack.</p>
<span class="cups111-hero__meta">31 Kreationen <span aria-hidden="true">✦</span> 4 Genusswelten</span></div>
<div class="cups111-hero__art" aria-label="Originalbilder unserer Eisbecher">
<div class="cups111-hero__art-main">{pic('tartufo-becher','Tartufo-Becher von Gelato Donatello','eager')}</div>
<div class="cups111-hero__art-small">{pic('erdbeer-becher','Erdbeer-Becher von Gelato Donatello','eager')}</div>
</div></div></section>
<section class="cups111-catalog" aria-labelledby="cups111-choose-title"><div class="cups111-catalog__container">
<div class="cups111-catalog__intro"><div><p class="cups111-eyebrow">WAS DARF’S HEUTE SEIN?</p>
<h2 id="cups111-choose-title">Vier Welten. <em>Dein Genuss.</em></h2></div>
<p>Wähle eine Kategorie und entdecke unsere Kreationen.</p></div>
<nav class="cups111-choices" aria-label="Eisbecher-Kategorien" data-cups-tabs>{tabs}</nav>
<p class="cups111-catalog__live visually-hidden" aria-live="polite" aria-atomic="true" data-cups-status></p>
</div></section><div class="cups111-collections" data-cups-collections>{panels}</div>
<aside class="cups111-outro" aria-label="Gelato Donatello besuchen"><div class="cups111-outro__inner">
<div><p class="cups111-eyebrow">AM BESTEN FRISCH VOR ORT</p><h2>Dein nächster <em>Genussmoment.</em></h2><p>Wir freuen uns auf dich in Köllerbach.</p></div>
<a href="/kontakt/" class="cups111-outro__link">Besuch uns <span aria-hidden="true">↗</span></a>
</div></aside></main><div id="site-footer"></div>
<script type="module" src="/assets/js/app.js"></script><script type="module" src="/assets/js/cups-v111.js"></script></body></html>'''
(root/'eisbecher/index.html').write_text(html)
print(f'V111: {len(groups)} categories, {len(files)} verified product images, {len(html)} HTML bytes')
