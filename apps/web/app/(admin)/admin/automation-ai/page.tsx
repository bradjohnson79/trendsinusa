import { redirect } from 'next/navigation';

export default function AdminAutomationAIPage() {
  // Backward-compatible redirect from earlier placeholder route.
  redirect('/admin/automation/dashboard');
}

