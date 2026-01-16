import { redirect } from 'next/navigation';

export default async function ProductPage(props: { params: Promise<{ asin: string }> }) {
  const { asin } = await props.params;
  redirect(`/product/${encodeURIComponent(asin)}`);
}
