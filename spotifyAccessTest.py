import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
import random
from dotenv import load_dotenv
import os
import subprocess
import sys
import spotdl  # Ensure spotDL is installed in your environment
import sqlite3
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from deepface import DeepFace
import numpy as np
import cv2
from ngrok import ngrok
has_mutagen = True
try:
    from mutagen.mp3 import MP3
    from mutagen import MutagenError
except Exception as import_err:
    # mutagen not available in environment; validation will be skipped with a clear error
    print(f"[import] mutagen import failed: {import_err}")
    has_mutagen = False
import mimetypes
import base64
from urllib.parse import quote

load_dotenv()

listener = ngrok.forward(5000, authtoken=os.getenv('NGROK_AUTH_TOKEN')) 
print(f"Ingress established at {listener.url()}") 

app = Flask(__name__)


CORS(app, origins=["http://localhost:5173", "hwgide2025.netlify.app", "https://3e9136036bb9.ngrok-free.app", "https://b8a819fefa4e.ngrok-free.app", "*"])

def detect_emotion_from_frame(frame):
    try:
        result = DeepFace.analyze(frame, actions=['emotion'], enforce_detection=False)
        if isinstance(result, list):
            emotion = result[0]['dominant_emotion']
        else:
            emotion = result['dominant_emotion']
        return emotion
    except Exception as e:
        return f"Error detecting emotion: {str(e)}"

@app.route('/secondaryfornow')
def index():
    return "Welcome to the Spotify Song Downloader API! This is not something you can use as a website, leave and let code do the rest.  Use the /get_song endpoint to download a song. HWGI"

@app.route('/songs/<filename>')
def serve_song(filename):
    songs_dir = os.path.abspath("songs")
    full_path = os.path.join(songs_dir, filename)
    print(f"[serve_song] requested: {filename}; full_path={full_path}")
    if not os.path.exists(full_path):
        print(f"[serve_song] file not found: {full_path}")
        return jsonify({'error': 'file not found'}), 404
    range_header = request.headers.get('Range', None)
    file_size = os.path.getsize(full_path)
    if range_header:
        print(f"[serve_song] Range header: {range_header}")
        try:
            range_val = range_header.strip().split('=')[1]
            start_str, end_str = range_val.split('-')
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else file_size - 1
        except Exception as e:
            print(f"[serve_song] failed to parse Range header: {e}")
            start = 0
            end = file_size - 1

        if start >= file_size:
            return jsonify({'error': 'Range start out of bounds'}), 416

        length = end - start + 1
        with open(full_path, 'rb') as fh:
            fh.seek(start)
            data = fh.read(length)

        from flask import Response
        rv = Response(data, 206, mimetype='audio/mpeg', direct_passthrough=True)
        rv.headers.add('Content-Range', f'bytes {start}-{end}/{file_size}')
        rv.headers.add('Accept-Ranges', 'bytes')
        rv.headers.add('Content-Length', str(length))
        rv.headers.add('Access-Control-Allow-Origin', '*')
        rv.headers.add('Content-Disposition', f'inline; filename="{filename}"')
        return rv

    try:
        response = send_file(full_path, mimetype='audio/mpeg')
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Content-Disposition'] = f'inline; filename="{filename}"'
        return response
    except Exception as e:
        print(f"[serve_song] error sending file: {e}")
        return jsonify({'error': 'failed to send file', 'details': str(e)}), 500

@app.route('/songs')
def list_songs():
    songs_dir = os.path.abspath("songs")
    files = []
    if os.path.exists(songs_dir):
        files = [f for f in os.listdir(songs_dir) if os.path.isfile(os.path.join(songs_dir, f))]
    return jsonify({'files': files})

@app.route('/', methods=['POST'])
def get_song():
    if 'photo' not in request.files:
        return jsonify({'error': 'photo file is required'}), 400

    photo = request.files['photo']
    file_bytes = np.frombuffer(photo.read(), np.uint8)
    frame = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    emotion = detect_emotion_from_frame(frame)
    if emotion.startswith("Error"):
        return jsonify({'error': emotion}), 500

    search_query = emotion
    # return search_query

    CLIENT_ID = os.getenv('CLIENT_ID')
    CLIENT_SECRET = os.getenv('CLIENT_SECRET')
    sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(client_id=CLIENT_ID, client_secret=CLIENT_SECRET))

    songDB = sqlite3.connect('songs.db')
    c = songDB.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS saved_songs (
            id TEXT PRIMARY KEY,
            name TEXT,
            artist TEXT, 
            search_query TEXT
        )
    ''')

    playlists = sp.search(q=search_query, type='playlist', limit=10)['playlists']['items']
    if not playlists:
        songDB.close()
        return jsonify({'error': 'No playlists found for the search query.'}), 404
    # return jsonify({'emotion': emotion, 'search_query': search_query, 'playlists_found': playlists})
    selected_playlist = None
    while selected_playlist is None:
        selected_playlist = random.choice(playlists)
    if selected_playlist is None or 'id' not in selected_playlist:
        songDB.close()
        return jsonify({'error': 'Selected playlist is invalid.'}), 500
    playlist_id = selected_playlist['id']
    playlist_tracks = sp.playlist_tracks(playlist_id, limit=100)['items']
    if not playlist_tracks:
        songDB.close()
        return jsonify({'error': 'No tracks found in the selected playlist.'}), 404

    track = {'popularity': 0}

    while track['popularity'] < 49 or "’" in track['name']:
        track = random.choice(playlist_tracks)['track']


    c.execute('''
        CREATE TABLE IF NOT EXISTS saved_songs (
            id TEXT PRIMARY KEY,
            name TEXT,
            artist TEXT, 
            search_query TEXT
        )
    ''')

    song_id = track['id']
    c.execute('SELECT id FROM saved_songs WHERE id = ?', (song_id,))
    row = c.fetchone()
    if row is None:
        songSaved = False
        saved_msg = ''
    else:
        songSaved = True
        saved_msg = 'Song already exists in database.'

    download_msg = ""
    filename = f"{track['name']}_{', '.join(artist['name'] for artist in track['artists'])}.mp3"
    filename = "".join([c if c.isalnum() or c in "._-" else "_" for c in filename])
    # return filename
    audio_path = os.path.abspath("songs/"+filename)
    # return audio_path

    if not songSaved:
        try:
            command = [
                "spotdl",  
                "--output", "newSong",
                track['external_urls']['spotify']
            ]
            subprocess.check_call(command)
            download_msg = f"Successfully downloaded {track['external_urls']['spotify']} in mp3 format."
            # command = [
            #     "mv", "./newSong/*.mp3", audio_path, 
            #     "&&", "rm", "-r", "newSong"
            # ]

            renameCommand = "mv ./newSong/*.mp3 "+audio_path
            # print(renameCommand)
            subprocess.check_call(renameCommand, shell=True)

            if os.path.exists(audio_path):
                if not has_mutagen:
                    print("[validation] mutagen is not installed; cannot validate mp3")
                    return jsonify({'error': "Server-side validation unavailable: mutagen not installed"}), 500
                try:
                    mp = MP3(audio_path)
                    if not getattr(mp.info, 'length', 0):
                        raise MutagenError('MP3 duration is zero')
                except Exception as e:
                    try:
                        os.remove(audio_path)
                    except Exception:
                        pass
                    download_msg = f"Downloaded file is not a valid MP3: {e}"
                    print(f"[validation] invalid mp3: {audio_path} -> {e}")
                    return jsonify({'error': download_msg}), 500
            try:
                c.execute('''
                    INSERT OR REPLACE INTO saved_songs (id, name, artist, search_query)
                    VALUES (?, ?, ?, ?)
                ''', (
                    song_id,
                    track['name'],
                    ', '.join(artist['name'] for artist in track['artists']),
                    search_query
                ))
                songDB.commit()
                songSaved = True
                saved_msg = 'Song saved to database.'
            except Exception as e:
                print(f"[db] failed to insert saved_songs for id={song_id}: {e}")
        except subprocess.CalledProcessError as e:
            download_msg = f"Error downloading {track['external_urls']['spotify']}: {e}"
            return jsonify({'error': download_msg}), 500
        except FileNotFoundError:
            download_msg = "Error: 'spotdl' command not found. Ensure spotDL is installed and accessible."
            return jsonify({'error': download_msg}), 500
    else:
        download_msg = "Skipping download since the song is already saved."
    file_url = f"{listener.url()}/songs/{quote(filename)}"
    file_mime, _ = mimetypes.guess_type(audio_path)
    file_size = None
    head_b64 = None
    if os.path.exists(audio_path):
        try:
            file_size = os.path.getsize(audio_path)
            with open(audio_path, 'rb') as fh:
                head = fh.read(128)
                head_b64 = base64.b64encode(head).decode('ascii')
        except Exception as e:
            print(f"[diagnostic] failed to read file head: {e}")

    # If client requested the audio directly, stream the file in the POST response
    if request.headers.get('X-Return-Audio') == '1' and os.path.exists(audio_path):
        try:
            response = send_file(audio_path, mimetype='audio/mpeg')
            # Attach metadata in response headers so the client can read song info when the audio
            # is streamed directly in the POST response.
            track_title = track.get('name')
            track_artist = ', '.join(artist['name'] for artist in track['artists'])
            track_album = track.get('album', {}).get('name', '')
            cover_url = ''
            try:
                imgs = track.get('album', {}).get('images', [])
                if imgs:
                    cover_url = imgs[0].get('url', '')
            except Exception:
                cover_url = ''

            response.headers['X-Track-Title'] = track_title or ''
            response.headers['X-Track-Artist'] = track_artist or ''
            response.headers['X-Track-Album'] = track_album or ''
            response.headers['X-Track-Cover'] = cover_url or ''
            # Allow browser JS to read our custom headers
            response.headers['Access-Control-Expose-Headers'] = 'X-Track-Title, X-Track-Artist, X-Track-Album, X-Track-Cover'
            response.headers['Access-Control-Allow-Origin'] = '*'
            return response
        except Exception as e:
            print(f"[serve_audio_in_post] error: {e}")
            return jsonify({'error': 'failed to stream audio', 'details': str(e)}), 500

    return jsonify({
        'track': {
            'name': track['name'],
            'artist': ', '.join(artist['name'] for artist in track['artists']),
            'album': track['album']['name'],
            'release_date': track['album']['release_date'],
            'popularity': track['popularity'],
            'spotify_url': track['external_urls']['spotify']
        },
        'saved_msg': saved_msg,
        'download_msg': download_msg,
        'file_url': file_url,
        'file_mime': file_mime,
        'file_size': file_size,
        'file_head_b64': head_b64
    })
    if os.path.exists(audio_path):
        return send_file(
            audio_path,
            mimetype="audio/mpeg",
            as_attachment=True,
            download_name=filename
        )
    else:
        return jsonify({
            'track': {
                'name': track['name'],
                'artist': ', '.join(artist['name'] for artist in track['artists']),
                'album': track['album']['name'],
                'release_date': track['album']['release_date'],
                'popularity': track['popularity'],
                'spotify_url': track['external_urls']['spotify']
            },
            'saved_msg': saved_msg,
            'download_msg': download_msg,
            'error': 'Audio file not found after download.'
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=False, port=5000)

# CLIENT_ID = os.getenv('CLIENT_ID')  # 'your_spotify_client_id'
# CLIENT_SECRET = os.getenv('CLIENT_SECRET')  # 'your_spotify_client_secret'

# sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(client_id=CLIENT_ID, client_secret=CLIENT_SECRET))

# songDB = sqlite3.connect('songs.db')
# c = songDB.cursor()

# songSaved = False

# search_query = "chill"
# playlists = sp.search(q=search_query, type='playlist', limit=10)['playlists']['items']

# if not playlists:
#     print("No playlists found for the search query.")
#     sys.exit(1)

# selected_playlist = random.choice(playlists)
# playlist_id = selected_playlist['id']

# playlist_tracks = sp.playlist_tracks(playlist_id, limit=100)['items']
# if not playlist_tracks:
#     print("No tracks found in the selected playlist.")
#     sys.exit(1)

# random_track = random.choice(playlist_tracks)['track']
# track = random_track
# # track = sp.track('https://open.spotify.com/track/5DxDLsW6PsLz5gkwC7Mk5S?si=6b517dd54983416a')  # Replace with any valid track ID

# c.execute('''
#     CREATE TABLE IF NOT EXISTS saved_songs (
#         id TEXT PRIMARY KEY,
#         name TEXT,
#         artist TEXT, 
#         search_query TEXT
#     )
# ''')

# song_id = track['id']
# c.execute('SELECT id FROM saved_songs WHERE id = ?', (song_id,))
# if c.fetchone() is None:
#     # Insert song into database
#     c.execute('''
#         INSERT INTO saved_songs (id, name, artist)
#         VALUES (?, ?, ?, ?)
#     ''', (
#         song_id,
#         track['name'],
#         ', '.join(artist['name'] for artist in track['artists']),
#         search_query
#     ))
#     songDB.commit()
#     print("Song saved to database.")
# else:
#     print("Song already exists in database.")
#     songSaved = True

# songDB.close()

# if not songSaved:
#     try:
#         command = ["spotdl", "--output", "{title}_{artist}.{output-ext}", track['external_urls']['spotify']]

#         print(f"Executing command: {' '.join(command)}")
#         subprocess.check_call(command)
#         print(f"Successfully downloaded {track['external_urls']['spotify']} in mp3 format.")

#     except subprocess.CalledProcessError as e:
#         print(f"Error downloading {track['external_urls']['spotify']}: {e}")
#     except FileNotFoundError:
#         print("Error: 'spotdl' command not found. Ensure spotDL is installed and accessible.")
# else:
#     print("Skipping download since the song is already saved.")



# # print(f"Song: {track['name']}")
# # print(f"Artist: {', '.join(artist['name'] for artist in track['artists'])}")
# # print(f"Album: {track['album']['name']}")
# # print(f"Release Date: {track['album']['release_date']}")
# # print(f"Popularity: {track['popularity']}")
# # print(f"Spotify URL: {track['external_urls']['spotify']}")
