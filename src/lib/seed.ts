import type { Album, AppState, Audience, Photo, User } from './model'

// Sample photographs are bundled so the first visit also works without remote image hosts.
const images: Record<string, string> = {
  'photo-1472099645785-5658abf4ff4e': 'avatar-2.jpg',
  'photo-1494790108377-be9c29b29330': 'avatar-3.jpg',
  'photo-1500648767791-00dcc994a43e': 'avatar-1.jpg',
  'photo-1534528741775-53994a69daeb': 'avatar-6.jpg',
  'photo-1506794778202-cad84cf45f1d': 'avatar-4.jpg',
  'photo-1517841905240-472988babdf9': 'avatar-7.jpg',
  'photo-1438761681033-6461ffad8d80': 'avatar-3.jpg',
  'photo-1560250097-0b93528c311a': 'avatar-5.jpg',
  'photo-1470770841072-f978cf4d019e': 'lake.jpg',
  'photo-1442512595331-e89e73853f31': 'cafe.png',
  'photo-1469474968028-56623f02e42e': 'golden-hour.jpg',
  'photo-1414235077428-338989a2e8c0': 'kitchen.jpg',
  'photo-1500530855697-b586d89ba3ee': 'countryside.jpg',
  'photo-1473116763249-2faaef81ccda': 'shore.jpg',
  'photo-1507525428034-b723cf961d3e': 'coast.jpg',
  'photo-1518837695005-2083093ee35b': 'beach.jpg',
  'photo-1468581264429-2548ef9eb732': 'island.jpg',
  'photo-1445116572660-236099ec97a0': 'cafe.png',
  'photo-1495474472287-4d71bcdd2085': 'coffee.png',
  'photo-1490750967868-88aa4486c946': 'dog.jpg',
  'photo-1476514525535-07fb3b4ae5f1': 'canoe.jpg',
  'photo-1464822759023-fed622ff2c3b': 'mountains.jpg',
  'photo-1472396961693-142e6e269027': 'dog.jpg',
  'photo-1511795409834-ef04bbd61622': 'afternoon.jpg',
  'photo-1512621776951-a57141f2eefd': 'kitchen.jpg',
}
const image = (id: string, _width = 1400) => `/photos/${images[id] || 'lake.jpg'}`

export const USERS: User[] = [
  { id: 'you', name: 'Alex Morgan', handle: 'alexmorgan', avatar: image('photo-1472099645785-5658abf4ff4e', 160), color: '#e8ddd0' },
  { id: 'sophie', name: 'Sophie Chen', handle: 'sophiechen', avatar: image('photo-1494790108377-be9c29b29330', 160), color: '#e8d3c9' },
  { id: 'james', name: 'James Wilson', handle: 'jameswilson', avatar: image('photo-1500648767791-00dcc994a43e', 160), color: '#d4ddd0' },
  { id: 'mia', name: 'Mia Thompson', handle: 'miathompson', avatar: image('photo-1534528741775-53994a69daeb', 160), color: '#e5d9cc' },
  { id: 'oliver', name: 'Oliver Park', handle: 'oliverpark', avatar: image('photo-1506794778202-cad84cf45f1d', 160), color: '#d3dce1' },
  { id: 'ella', name: 'Ella Davis', handle: 'elladavis', avatar: image('photo-1517841905240-472988babdf9', 160), color: '#e8d6c2' },
  { id: 'mum', name: 'Mum', handle: 'sarahmorgan', avatar: image('photo-1438761681033-6461ffad8d80', 160), color: '#e9d9cd' },
  { id: 'dad', name: 'Dad', handle: 'davidmorgan', avatar: image('photo-1560250097-0b93528c311a', 160), color: '#d6dfd3' },
]

const photo = (id: string, src: string, caption: string, audience: Audience = 'friends', highlight = false): Photo => ({
  id, src: image(src), caption, audience, highlight,
})

const albums: Album[] = [
  {
    id: 'sophie-october', title: 'A little bit of October',
    caption: 'Long walks, slow mornings, and a few moments I want to keep. Life lately has been pretty lovely.',
    authorId: 'sophie', period: '2026-10', createdAt: '2026-11-02T06:30:00Z', audience: 'friends',
    photos: [
      photo('sophie-1', 'photo-1470770841072-f978cf4d019e', 'The kind of morning you wish would last a little longer.'),
      photo('sophie-2', 'photo-1442512595331-e89e73853f31', 'Slow mornings and something freshly brewed.'),
      photo('sophie-3', 'photo-1469474968028-56623f02e42e', 'Took the long way home.'),
      photo('sophie-4', 'photo-1414235077428-338989a2e8c0', 'Dinner with my favourite people.'),
      photo('sophie-5', 'photo-1500530855697-b586d89ba3ee', 'A whole afternoon with no plans.'),
    ],
  },
  {
    id: 'james-coast', title: 'Somewhere by the sea',
    caption: 'A little escape to the coast. Salty hair, no alarm clocks, and absolutely no complaints.',
    authorId: 'james', period: '2026-10', createdAt: '2026-11-01T08:00:00Z', audience: 'friends',
    photos: [
      photo('james-1', 'photo-1473116763249-2faaef81ccda', 'Found our own little stretch of coastline.'),
      photo('james-2', 'photo-1507525428034-b723cf961d3e', 'The best kind of blue.'),
      photo('james-3', 'photo-1518837695005-2083093ee35b', 'One last look before we left.'),
      photo('james-4', 'photo-1468581264429-2548ef9eb732', 'Already planning the next trip.'),
    ],
  },
  {
    id: 'mia-slow', title: 'The slow days',
    caption: 'Not much happened. That was kind of the point. A few small things from the last few weeks.',
    authorId: 'mia', period: '2026-10', createdAt: '2026-10-31T10:00:00Z', audience: 'friends',
    photos: [
      photo('mia-1', 'photo-1445116572660-236099ec97a0', 'The café down the street is becoming a habit.'),
      photo('mia-2', 'photo-1495474472287-4d71bcdd2085', 'A good start.'),
      photo('mia-3', 'photo-1490750967868-88aa4486c946', 'Our very enthusiastic walking companion.'),
    ],
  },
  {
    id: 'oliver-weekend', title: 'A weekend well spent',
    caption: 'Fresh air does a lot of good. We packed too many snacks and came home with muddy shoes.',
    authorId: 'oliver', period: '2026-10', createdAt: '2026-10-30T12:00:00Z', audience: 'friends',
    photos: [
      photo('oliver-1', 'photo-1476514525535-07fb3b4ae5f1', 'Worth every step to get here.'),
      photo('oliver-2', 'photo-1464822759023-fed622ff2c3b', 'A little perspective.'),
      photo('oliver-3', 'photo-1472396961693-142e6e269027', 'Always ready for the next walk.'),
    ],
  },
  {
    id: 'ella-sunday', title: 'Sunday, all together',
    caption: 'A long lunch that turned into a very long afternoon. More of this, please.',
    authorId: 'ella', period: '2026-09', createdAt: '2026-10-02T07:00:00Z', audience: 'public',
    photos: [
      photo('ella-1', 'photo-1511795409834-ef04bbd61622', 'The best afternoons are the ones spent together.', 'public'),
      photo('ella-2', 'photo-1512621776951-a57141f2eefd', 'Everyone brought a little something.', 'public'),
      photo('ella-3', 'photo-1414235077428-338989a2e8c0', 'The best seat is the one next to you.', 'public'),
    ],
  },
  {
    id: 'your-october', title: 'October, in little moments',
    caption: 'The little things that made this month feel like mine. A quieter kind of happy.',
    authorId: 'you', period: '2026-10', createdAt: '2026-10-31T20:00:00Z', audience: 'friends',
    photos: [
      photo('you-oct-1', 'photo-1476514525535-07fb3b4ae5f1', 'A Sunday with nowhere else to be.', 'friends', true),
      photo('you-oct-2', 'photo-1442512595331-e89e73853f31', 'The first coffee of the day.', 'friends'),
      photo('you-oct-3', 'photo-1500530855697-b586d89ba3ee', 'Chasing the last light.', 'friends', true),
      photo('you-oct-4', 'photo-1490750967868-88aa4486c946', 'Someone was very happy to have us home.', 'family'),
    ],
  },
  {
    id: 'your-september', title: 'September’s golden hours',
    caption: 'A few days away and a lot of little reasons to smile. Keeping these close.',
    authorId: 'you', period: '2026-09', createdAt: '2026-09-30T20:00:00Z', audience: 'friends',
    photos: [
      photo('you-sep-1', 'photo-1469474968028-56623f02e42e', 'A view I keep coming back to.', 'friends', true),
      photo('you-sep-2', 'photo-1507525428034-b723cf961d3e', 'Nothing on the calendar but this.', 'friends', true),
      photo('you-sep-3', 'photo-1472396961693-142e6e269027', 'The quietest company.', 'besties'),
      photo('you-sep-4', 'photo-1495474472287-4d71bcdd2085', 'Our family catch-up, over something warm.', 'family', true),
    ],
  },
]

export function seedState(): AppState {
  const user = (id: string) => USERS.find(person => person.id === id)!
  return structuredClone({
    albums,
    circles: [
      { id: 'family', name: 'Family', description: 'The people who have been there since the beginning.', members: [user('mum'), user('dad')] },
      { id: 'besties', name: 'Besties', description: 'Your people, through every little chapter.', members: [user('sophie'), user('mia')] },
      { id: 'friends', name: 'Friends', description: 'Familiar faces you want to keep in the loop.', members: [user('sophie'), user('james'), user('mia'), user('oliver'), user('ella')] },
    ],
    likedAlbumIds: [],
    savedAlbumIds: [],
    notes: {},
    settings: { reminders: false, cadence: 'Monthly' },
  }) as AppState
}
