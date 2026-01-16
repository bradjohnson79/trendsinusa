import { redirect } from 'next/navigation';

export default async function CategoryPage(props: { params: Promise<{ category: string }> }) {
  const { category } = await props.params;
  redirect(`/category/${encodeURIComponent(category)}`);
}

