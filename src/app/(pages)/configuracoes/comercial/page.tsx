import { redirect } from 'next/navigation'

import { getHomeTabHref } from '@/app/helpers/home-tabs'

const OldVoiceSettingsPage = () => redirect(getHomeTabHref('comercial'))

export default OldVoiceSettingsPage
