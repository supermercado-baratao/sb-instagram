import { redirect } from 'next/navigation'

// Bookmarks saved when each offer had its own page (#80)
const OldOfferPage = () => redirect('/')

export default OldOfferPage
