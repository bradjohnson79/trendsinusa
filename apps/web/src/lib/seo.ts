type MetaKind = { name: string; content: string } | { property: string; content: string };

function upsertMeta(tag: MetaKind) {
  const head = document.head;
  const selector = 'name' in tag ? `meta[name="${CSS.escape(tag.name)}"]` : `meta[property="${CSS.escape(tag.property)}"]`;
  let el = head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    if ('name' in tag) el.setAttribute('name', tag.name);
    else el.setAttribute('property', tag.property);
    head.appendChild(el);
  }
  el.setAttribute('content', tag.content);
}

function upsertLink(rel: string, href: string) {
  const head = document.head;
  const selector = `link[rel="${CSS.escape(rel)}"]`;
  let el = head.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function setSeo(params: {
  title: string;
  description?: string;
  url?: string;
  ogImageUrl?: string;
  jsonLdId?: string;
  jsonLd?: unknown;
}) {
  document.title = params.title;
  if (params.description) {
    upsertMeta({ name: 'description', content: params.description });
    upsertMeta({ property: 'og:description', content: params.description });
    upsertMeta({ name: 'twitter:description', content: params.description });
  }
  upsertMeta({ property: 'og:title', content: params.title });
  upsertMeta({ name: 'twitter:title', content: params.title });
  upsertMeta({ property: 'og:type', content: 'article' });
  if (params.url) {
    upsertMeta({ property: 'og:url', content: params.url });
    upsertLink('canonical', params.url);
  }
  if (params.ogImageUrl) {
    upsertMeta({ property: 'og:image', content: params.ogImageUrl });
    upsertMeta({ name: 'twitter:card', content: 'summary_large_image' });
  }

  if (params.jsonLdId && params.jsonLd) {
    const head = document.head;
    const id = params.jsonLdId;
    let el = head.querySelector(`script[type="application/ld+json"][data-id="${CSS.escape(id)}"]`) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.setAttribute('data-id', id);
      head.appendChild(el);
    }
    el.text = JSON.stringify(params.jsonLd);
  }
}

