export interface JukeboxCatalogSong {
  id: string;
  vendor?: {
    id: string;
    name: string;
  };
  effective?: {
    beginDate: string;
    endDate: string;
  };
  title: string;
  artist: string;
  youtubeUrl: string;
  approxDurationSeconds: number;
  approxDurationText: string;
  vibe: string;
  marqueeTexts: string[];
  flavorTexts: string[];
  tags: string[];
}

export const JUKEBOX_CATALOGS: Record<string, JukeboxCatalogSong[]> = {
  prototypehub_classic_yt: [
    {
      id: 'song_001',
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      approxDurationSeconds: 213,
      approxDurationText: 'about 3.5 minutes',
      vibe: 'unavoidable',
      marqueeTexts: [
        "You feel like you've been here before...",
        'The machine seems very pleased with itself.',
        "Someone at the table says, 'No. Not again.'",
        'The jukebox insists this is a classic.',
        "A few patrons pretend they don't know every word.",
      ],
      flavorTexts: [
        'Someone at the table groans. Another one quietly sings along.',
        "A chair scrapes as someone considers leaving, then doesn't.",
        'The room briefly becomes complicit.',
      ],
      tags: ['classic', 'meme', 'dangerous'],
    },
    {
      id: 'song_002',
      title: 'Take On Me',
      artist: 'a-ha',
      youtubeUrl: 'https://www.youtube.com/watch?v=djV11Xbc914',
      approxDurationSeconds: 225,
      approxDurationText: 'about 3.75 minutes',
      vibe: 'energetic',
      marqueeTexts: [
        'The synth kicks in like it owns the room.',
        'The jukebox suddenly becomes angular and dramatic.',
        'Someone attempts a note they absolutely cannot reach.',
        'The room feels like it should be drawn in pencil for a second.',
        'A nearby patron points at nothing and looks inspired.',
      ],
      flavorTexts: [
        'A few heads turn. Someone attempts the high note. Regret follows.',
        'The song makes everyone feel faster than they are.',
        'Someone near the wall starts moving like they saw this in a music video once.',
      ],
      tags: ['80s', 'high-energy'],
    },
    {
      id: 'song_003',
      title: 'Africa',
      artist: 'Toto',
      youtubeUrl: 'https://www.youtube.com/watch?v=FTQbiNvZqaY',
      approxDurationSeconds: 295,
      approxDurationText: 'about 5 minutes',
      vibe: 'collective nostalgia',
      marqueeTexts: [
        'The room gets weirdly sincere.',
        'Several people look like they just remembered weather.',
        'The jukebox glows with unreasonable confidence.',
        'Someone raises a glass toward no one in particular.',
        'The whole lobby becomes emotionally humid.',
      ],
      flavorTexts: [
        'The entire room becomes emotionally compromised.',
        'Nobody admits they were waiting for this one.',
        'Someone at a table nods like this song helped raise them.',
      ],
      tags: ['classic', 'singalong'],
    },
    {
      id: 'song_004',
      title: 'All Star',
      artist: 'Smash Mouth',
      youtubeUrl: 'https://www.youtube.com/watch?v=L_jWHffIx5E',
      approxDurationSeconds: 201,
      approxDurationText: 'about 3.35 minutes',
      vibe: 'chaotic good',
      marqueeTexts: [
        'The first second is enough. Everyone knows.',
        'The jukebox chooses violence, but cheerfully.',
        "Somebody nearby whispers, 'Oh no.'",
        'The room becomes slightly more swamp-adjacent.',
        'A patron laughs before the song has earned it.',
      ],
      flavorTexts: [
        "You didn't ask for this. But here it is.",
        'Someone accepts the situation with alarming speed.',
        'The song arrives wearing sunglasses indoors.',
      ],
      tags: ['meme', 'chaos'],
    },
    {
      id: 'song_005',
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      youtubeUrl: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
      approxDurationSeconds: 354,
      approxDurationText: 'about 6 minutes',
      vibe: 'dramatic',
      marqueeTexts: [
        'The jukebox prepares for a journey.',
        'The room realizes this is going to take a while.',
        'Someone sits up straighter, as if assigned a role.',
        'The song changes mood and everyone pretends this is normal.',
        'Several patrons appear ready for their cue.',
      ],
      flavorTexts: [
        'Half the room commits fully. The other half suffers.',
        'Someone near the back treats this like sacred theater.',
        'By the time the song shifts gears, the lobby has accepted its fate.',
      ],
      tags: ['epic', 'long', 'group-event'],
    },
    {
      id: 'song_006',
      title: 'Mr. Brightside',
      artist: 'The Killers',
      youtubeUrl: 'https://www.youtube.com/watch?v=gGdGFtwCNBE',
      approxDurationSeconds: 222,
      approxDurationText: 'about 3.7 minutes',
      vibe: 'escalating',
      marqueeTexts: [
        'The room starts too calm for what is about to happen.',
        'Someone has been waiting for this all night.',
        'The jukebox unlocks a specific kind of public emotion.',
        'Several people suddenly remember being twenty-two.',
        'The energy rises like a bad decision.',
      ],
      flavorTexts: [
        'You can feel the volume rising whether you like it or not.',
        'A table of strangers becomes a choir with no rehearsal.',
        'Someone sings like this is evidence in a trial.',
      ],
      tags: ['crowd', 'singalong'],
    },
    {
      id: 'song_007',
      title: 'Sandstorm',
      artist: 'Darude',
      youtubeUrl: 'https://www.youtube.com/watch?v=y6120QOlsfU',
      approxDurationSeconds: 230,
      approxDurationText: 'about 3.8 minutes',
      vibe: 'pure chaos',
      marqueeTexts: [
        'The room loses all structure.',
        'The jukebox becomes a machine for poor choices.',
        'Someone asks what song this is. Someone else refuses to answer.',
        'The beat arrives and sweeps the floor out from under everyone.',
        'The lobby briefly becomes a very small rave.',
      ],
      flavorTexts: [
        'Someone is dancing. No one knows who started it.',
        'The lights seem more aggressive than they were a moment ago.',
        'A chair moves two inches for reasons no one can prove.',
      ],
      tags: ['instrumental', 'chaos'],
    },
    {
      id: 'song_008',
      title: 'Careless Whisper',
      artist: 'George Michael',
      youtubeUrl: 'https://www.youtube.com/watch?v=izGwDsrQ1eQ',
      approxDurationSeconds: 300,
      approxDurationText: 'about 5 minutes',
      vibe: 'suspicious',
      marqueeTexts: [
        'The saxophone knows things.',
        'The room gets softer and more dangerous.',
        'Someone avoids eye contact too late.',
        'The jukebox lowers the lights emotionally.',
        'A patron clears their throat like they have a past.',
      ],
      flavorTexts: [
        'Eye contact becomes a liability.',
        'Someone at the bar suddenly has a tragic backstory.',
        'The song makes every silence feel intentional.',
      ],
      tags: ['slow', 'awkward'],
    },
    {
      id: 'song_009',
      title: 'Sweet Caroline',
      artist: 'Neil Diamond',
      youtubeUrl: 'https://www.youtube.com/watch?v=1vhFnTjia_I',
      approxDurationSeconds: 203,
      approxDurationText: 'about 3.4 minutes',
      vibe: 'group trigger',
      marqueeTexts: [
        'The room braces itself.',
        'Someone inhales with terrible purpose.',
        'The jukebox has activated a crowd reflex.',
        'You can feel the response coming before it happens.',
        'Several patrons become louder than necessary.',
      ],
      flavorTexts: [
        'You already know what happens next.',
        'The lobby briefly stops being individuals and becomes a single problem.',
        'Someone who claimed to hate this song participates anyway.',
      ],
      tags: ['call-response', 'crowd'],
    },
    {
      id: 'song_010',
      title: 'Never Enough (Loop Variant)',
      artist: 'Unknown Patron',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      approxDurationSeconds: 120,
      approxDurationText: 'about 2 minutes',
      vibe: 'concerning',
      marqueeTexts: [
        'Again. And again. And again.',
        'The jukebox accepts the duplicate without judgment.',
        'Someone has made a choice. Repeatedly.',
        'The queue looks familiar in a threatening way.',
        'The machine seems trapped, but not surprised.',
      ],
      flavorTexts: [
        'The same song has been queued 17 times.',
        'A patron stares into the distance like they caused this.',
        'Someone checks the queue and quietly gives up.',
      ],
      tags: ['loop', 'npc-chaos', 'duplicate-friendly'],
    },
    {
      id: 'song_011',
      title: 'Queue Limit Test Beep',
      artist: 'Service Mode',
      youtubeUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      approxDurationSeconds: 15,
      approxDurationText: 'about 15 seconds',
      vibe: 'diagnostic',
      marqueeTexts: [
        'A tiny test track slips out like a systems check.',
        'The jukebox does a quick polite self-test.',
        'Fifteen seconds of proof and then it is gone.',
      ],
      flavorTexts: [
        'Someone looks up, confused, then shrugs.',
        'The room barely has time to react before it is over.',
        'It feels less like a song and more like a checkbox getting ticked.',
      ],
      tags: ['test', 'short', 'diagnostic'],
    },
    {
      id: 'song_audio_slave_001',
      vendor: {
        id: 'vendor_classic_yt',
        name: 'Classic YouTube Jukebox',
      },
      effective: {
        beginDate: '2026-01-01',
        endDate: '9999-12-31',
      },
      title: 'Audio Slave',
      artist: 'Unknown Patron',
      youtubeUrl: 'https://www.youtube.com/watch?v=vVXIK1xCRpY',
      approxDurationSeconds: 240,
      approxDurationText: 'about 4 minutes',
      vibe: 'obediently loud',
      marqueeTexts: [
        'The jukebox obeys with suspicious enthusiasm.',
        'The speakers hum like they have accepted their purpose.',
        "Someone says, 'Audio slave?' and the machine takes it personally.",
        'The lobby is now under new sonic management.',
        'The jukebox waits for its next command.',
      ],
      flavorTexts: [
        'The room gets louder in a way that feels contractual.',
        'Someone nods along like they understand the assignment.',
        'The machine plays like it has no rights and no regrets.',
      ],
      tags: ['loud', 'machine', 'obedient', 'experimental'],
    },
  ],
};