import { describe, expect, it } from 'vitest'
import {
  AUDIENCES,
  canSeeAudience,
  canSeePhoto,
  effectiveAudience,
  photoAudienceOptions,
  visiblePhotos,
  type Album,
  type Audience,
  type Photo,
} from './model'
import { seedState, USERS } from './seed'

const picture = (id: string, audience: Audience): Photo => ({ id, src: '/photo.jpg', caption: '', audience, highlight: false })

describe('album and photo audience rules', () => {
  it('lets each preview role see only the audiences it belongs to', () => {
    const expected: Record<Audience, Audience[]> = {
      public: ['public'],
      friends: ['public', 'friends'],
      besties: ['public', 'friends', 'besties'],
      family: ['public', 'friends', 'family'],
      private: ['public', 'friends', 'besties', 'family', 'private'],
    }
    for (const viewer of AUDIENCES) {
      expect(AUDIENCES.filter(audience => canSeeAudience(audience, viewer))).toEqual(expected[viewer])
    }
  })

  it('keeps family-only and besties-only memories out of other circles', () => {
    expect(canSeePhoto(picture('family', 'family'), 'friends', 'friends')).toBe(false)
    expect(canSeePhoto(picture('family', 'family'), 'friends', 'besties')).toBe(false)
    expect(canSeePhoto(picture('family', 'family'), 'friends', 'family')).toBe(true)
    expect(canSeePhoto(picture('besties', 'besties'), 'friends', 'family')).toBe(false)
  })

  it('never lets a public photo setting widen an album audience', () => {
    expect(effectiveAudience('public', 'family')).toBe('family')
    expect(canSeePhoto(picture('open', 'public'), 'family', 'friends')).toBe(false)
    expect(canSeePhoto(picture('open', 'public'), 'family', 'public')).toBe(false)
    expect(canSeePhoto(picture('open', 'public'), 'family', 'family')).toBe(true)
  })

  it('keeps incompatible circles and private albums owner-only', () => {
    expect(effectiveAudience('family', 'besties')).toBe('private')
    expect(effectiveAudience('besties', 'family')).toBe('private')
    for (const audience of AUDIENCES) {
      expect(effectiveAudience(audience, 'private')).toBe('private')
      expect(effectiveAudience('private', audience)).toBe('private')
      expect(canSeePhoto(picture('owner', audience), 'private', 'private')).toBe(true)
    }
  })

  it('requires both album and photo access across every audience combination', () => {
    for (const albumAudience of AUDIENCES) {
      for (const photoAudience of AUDIENCES) {
        for (const viewer of AUDIENCES) {
          expect(canSeePhoto(picture('sample', photoAudience), albumAudience, viewer)).toBe(
            canSeeAudience(albumAudience, viewer) && canSeeAudience(photoAudience, viewer),
          )
        }
      }
    }
  })

  it('offers only photo choices that respect the album limit', () => {
    expect(photoAudienceOptions('family')).toEqual(['family', 'private'])
    expect(photoAudienceOptions('besties')).toEqual(['besties', 'private'])
    expect(photoAudienceOptions('private')).toEqual(['private'])
    for (const albumAudience of AUDIENCES) {
      for (const option of photoAudienceOptions(albumAudience)) {
        expect(effectiveAudience(option, albumAudience)).toBe(option)
      }
    }
  })

  it('filters an album without leaking private photos or changing its source', () => {
    const album: Album = {
      id: 'privacy-example', authorId: 'you', title: 'A month', caption: '',
      audience: 'friends', period: '2026-10', createdAt: '2026-11-01T00:00:00Z',
      photos: [picture('everyone', 'friends'), picture('family', 'family'), picture('owner', 'private')],
    }
    expect(visiblePhotos(album, 'friends').map(photo => photo.id)).toEqual(['everyone'])
    expect(visiblePhotos(album, 'family').map(photo => photo.id)).toEqual(['everyone', 'family'])
    expect(visiblePhotos(album, 'public')).toEqual([])
    expect(visiblePhotos(album, 'private')).toHaveLength(3)
    expect(album.photos).toHaveLength(3)
  })
})

describe('demo albums', () => {
  it('has a personal collection and a friend feed with valid photo and author references', () => {
    const state = seedState()
    expect(state.albums.filter(album => album.authorId === 'you')).toHaveLength(2)
    expect(state.albums.filter(album => album.authorId !== 'you')).toHaveLength(5)
    expect(new Set(state.albums.map(album => album.id)).size).toBe(state.albums.length)
    const photoIds = state.albums.flatMap(album => album.photos.map(photo => photo.id))
    expect(new Set(photoIds).size).toBe(photoIds.length)
    for (const album of state.albums) {
      expect(USERS.some(user => user.id === album.authorId)).toBe(true)
      expect(album.period).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/)
      expect(Number.isNaN(Date.parse(album.createdAt))).toBe(false)
      expect(album.photos.length).toBeGreaterThan(1)
      for (const photo of album.photos) {
        expect(photo.src).toBeTruthy()
        expect(photoAudienceOptions(album.audience)).toContain(photo.audience)
      }
    }
  })

  it('starts with distinct circles and narrower highlight memories for privacy testing', () => {
    const state = seedState()
    expect(state.circles.map(circle => circle.id)).toEqual(['family', 'besties', 'friends'])
    expect(state.circles.every(circle => circle.members.length > 0)).toBe(true)
    expect(state.albums.filter(album => album.authorId === 'you').flatMap(album => album.photos)
      .some(photo => photo.highlight && photo.audience === 'family')).toBe(true)
  })

  it('returns independent copies so edits never alter future initial state', () => {
    const first = seedState()
    first.albums[0].title = 'Edited'
    first.albums[0].photos.pop()
    first.circles[0].members[0].name = 'Changed name'
    first.settings.reminders = true
    const second = seedState()
    expect(second.albums[0].title).toBe('A little bit of October')
    expect(second.albums[0].photos).toHaveLength(5)
    expect(second.circles[0].members[0].name).toBe('Mum')
    expect(second.settings.reminders).toBe(false)
    expect(USERS.find(user => user.id === 'mum')?.name).toBe('Mum')
  })
})
