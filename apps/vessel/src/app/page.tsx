import {getOwner, SITES} from '../lib/site'

export const dynamic = 'force-dynamic'

/** Vessel root: points at whatever has risen in each site dataset. */
export default async function Home() {
  const owners = await Promise.all(
    SITES.map(async (site) => ({site, owner: await getOwner(site).catch(() => null)})),
  )
  const risen = owners.filter((o) => o.owner)
  return (
    <main className="vessel-home">
      <h1>Vessel</h1>
      {risen.length ? (
        <ul>
          {risen.map(({site, owner}) => (
            <li key={site}>
              <a href={`/${site}`}>{owner?.siteTitle ?? site}</a>
              {owner?.seanceUrl ? <span> · resurrected from {owner.seanceUrl}</span> : null}
              {owner?.risenAt ? null : <span> · still in its release</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p>Vessel is empty. Raise something.</p>
      )}
    </main>
  )
}
