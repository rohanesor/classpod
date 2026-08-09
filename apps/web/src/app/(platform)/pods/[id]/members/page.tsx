import { PodMembersClient } from './members-client';

export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function PodMembersPage() {
  return <PodMembersClient />;
}
