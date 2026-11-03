export type Audience = 'family' | 'besties' | 'friends' | 'public' | 'private'

export interface User {
  id: string
  name: string
  handle: string
  avatar: string
  color: string
}

export interface Photo {
  id: string
  src: string
  caption: string
  audience: Audience
  highlight: boolean
}

export interface Album {
  id: string
  title: string
  caption: string
  authorId: string
  /** The month the album belongs to, in YYYY-MM format. */
  period: string
  createdAt: string
  audience: Audience
  photos: Photo[]
}

export interface Circle {
  id: 'family' | 'besties' | 'friends'
  name: string
  description: string
  members: User[]
}

export interface Note {
  id: string
  text: string
  createdAt: string
}

export interface AppState {
  albums: Album[]
  circles: Circle[]
  likedAlbumIds: string[]
  savedAlbumIds: string[]
  notes: Record<string, Note[]>
  settings: {
    reminders: boolean
    cadence: string
  }
}

/** Available audiences in order from most to least open. */
export const AUDIENCES: Audience[] = ['public', 'friends', 'besties', 'family', 'private']

/**
 * An album is an upper bound on a photo's audience. A broader photo setting
 * cannot expand it. Family and besties are separate circles, so their
 * intersection is conservatively owner-only in this single-circle demo model.
 * These helpers are presentation rules, not server-side access control.
 */
export function effectiveAudience(photoAudience: Audience, albumAudience: Audience): Audience {
  if (photoAudience === albumAudience) return photoAudience
  if (photoAudience === 'private' || albumAudience === 'private') return 'private'
  if (albumAudience === 'public') return photoAudience
  if (photoAudience === 'public') return albumAudience
  if (albumAudience === 'friends') return photoAudience
  if (photoAudience === 'friends') return albumAudience
  return 'private'
}

/** 'private' as a viewer means the owner, who can see their entire album. */
export function canSeeAudience(audience: Audience, viewerAudience: Audience): boolean {
  if (viewerAudience === 'private') return true
  if (audience === 'private') return false
  if (audience === 'public') return true
  if (audience === 'friends') return viewerAudience !== 'public'
  return audience === viewerAudience
}

export function canSeePhoto(photo: Photo, albumAudience: Audience, viewerAudience: Audience): boolean {
  return canSeeAudience(effectiveAudience(photo.audience, albumAudience), viewerAudience)
}

export function visiblePhotos(album: Album, viewerAudience: Audience): Photo[] {
  return album.photos.filter(photo => canSeePhoto(photo, album.audience, viewerAudience))
}

/** These choices keep photo privacy at least as restrictive as the album. */
export function photoAudienceOptions(albumAudience: Audience): Audience[] {
  if (albumAudience === 'public') return [...AUDIENCES]
  if (albumAudience === 'friends') return ['friends', 'besties', 'family', 'private']
  if (albumAudience === 'private') return ['private']
  return [albumAudience, 'private']
}
