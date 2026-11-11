import { redirect } from 'next/navigation'

import { RADIO_AD_PATH } from '@/app/helpers/navigation'

const OldRadioAdPage = () => redirect(RADIO_AD_PATH)

export default OldRadioAdPage
