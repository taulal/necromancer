import type {NextConfig} from 'next'

const config: NextConfig = {
  transpilePackages: [
    '@necro/bones',
    '@necro/rituals',
    '@necro/exhume',
    '@necro/autopsy',
    '@necro/interrogate',
    '@necro/reanimate',
    '@necro/hq-schema',
  ],
}

export default config
