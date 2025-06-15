
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/decks');
  // The redirect function automatically throws a NEXT_REDIRECT error, so this component
  // will stop rendering and the redirect will occur on the server.
  // Thus, returning null or any JSX here is not strictly necessary but good practice.
  return null;
}
