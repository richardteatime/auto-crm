import { NextResponse } from "next/server";

// Serves the embed loader script. Usage on a customer site:
//   <script src="https://YOUR-CRM/embed/form.js" data-form-id="FORM_ID"></script>
// It injects a same-origin iframe to /form/FORM_ID?embed=1 and auto-resizes it
// from height messages posted by the embedded page.
export function GET() {
  const js = `(function(){
  var s = document.currentScript;
  if(!s){ return; }
  var id = s.getAttribute('data-form-id');
  if(!id){ console.error('[SarconX] data-form-id mancante sullo script di embed'); return; }
  var origin = new URL(s.src).origin;
  var iframe = document.createElement('iframe');
  iframe.src = origin + '/form/' + encodeURIComponent(id) + '?embed=1';
  iframe.style.width = '100%';
  iframe.style.border = '0';
  iframe.style.minHeight = '480px';
  iframe.setAttribute('title', 'Form');
  iframe.setAttribute('loading', 'lazy');
  s.parentNode.insertBefore(iframe, s);
  window.addEventListener('message', function(e){
    if(e.origin !== origin){ return; }
    var d = e.data;
    if(d && d.type === 'sarconx-form-height' && d.id === id && d.height){
      iframe.style.height = d.height + 'px';
    }
  });
})();`;

  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
