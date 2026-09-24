import { redirect } from 'next/navigation'

// The app is one page. Any other path goes to "/" once; real files and /api
// are served before this route is ever matched, and "/" never reaches it,
// so it can't loop.
export default function Rest() {
  redirect('/')
}
