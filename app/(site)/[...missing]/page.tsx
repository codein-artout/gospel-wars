import { notFound } from 'next/navigation';

/** Unknown paths render the site's not-found page inside the shell. */
export default function Missing() {
  notFound();
}
