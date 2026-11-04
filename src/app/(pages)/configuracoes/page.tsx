import { redirect } from 'next/navigation'

import { getHomeTabHref } from '@/app/helpers/home-tabs'

const OldBrandSettingsPage = () => redirect(getHomeTabHref('marca'))

export default OldBrandSettingsPage
