import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Audio, AVPlaybackStatus } from 'expo-av';
import Slider from '@react-native-community/slider';

interface AudioAsset {
  id: string;
  filename: string;
  uri: string;
}

const App: React.FC = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [audioAssets, setAudioAssets] = useState<AudioAsset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [playbackInstance, setPlaybackInstance] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [position, setPosition] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isSeeking, setIsSeeking] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          "Permission required", 
          "This app needs access to your media library to display your music."
        );
        setHasPermission(false);
        setLoading(false);
      } else {
        setHasPermission(true);
        await loadAudioAssets();
      }
    })();

    // Clean up the playback instance on unmount
    return () => {
      if (playbackInstance) {
        playbackInstance.unloadAsync();
      }
    };
  }, []);

  // Fetch all audio assets from the device
  const loadAudioAssets = async () => {
    try {
      const media = await MediaLibrary.getAssetsAsync({
        mediaType: 'audio',
        first: 1000, // Adjust as needed to fetch more files
      });
      const assets: AudioAsset[] = media.assets.map(asset => ({
        id: asset.id,
        filename: asset.filename,
        uri: asset.uri,
      }));
      setAudioAssets(assets);
    } catch (error) {
      console.error("Error fetching audio assets:", error);
    }
    setLoading(false);
  };

  // Update playback status for slider and auto-playing next track
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.error("Playback error:", status.error);
      }
    } else {
      if (!isSeeking) {
        setPosition(status.positionMillis);
        setDuration(status.durationMillis ?? 0);
      }
      setIsPlaying(status.isPlaying);
      // Automatically play next track if current track finishes
      if (status.didJustFinish) {
        handleNext();
      }
    }
  };

  // Play the selected audio track
  const playAudio = async (index: number) => {
    try {
      // Unload previous track if exists
      if (playbackInstance) {
        await playbackInstance.unloadAsync();
        setPlaybackInstance(null);
      }
      const asset = audioAssets[index];
      const { sound } = await Audio.Sound.createAsync(
        { uri: asset.uri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      setPlaybackInstance(sound);
      setCurrentTrackIndex(index);
      setIsPlaying(true);
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  };

  // Toggle play/pause for the current track
  const handlePlayPause = async () => {
    if (playbackInstance) {
      if (isPlaying) {
        await playbackInstance.pauseAsync();
      } else {
        await playbackInstance.playAsync();
      }
    }
  };

  // Play the next track; loop to beginning if at end
  const handleNext = async () => {
    if (audioAssets.length === 0) return;
    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= audioAssets.length) {
      nextIndex = 0;
    }
    playAudio(nextIndex);
  };

  // Play the previous track; loop to end if at beginning
  const handlePrevious = async () => {
    if (audioAssets.length === 0) return;
    let prevIndex = currentTrackIndex - 1;
    if (prevIndex < 0) {
      prevIndex = audioAssets.length - 1;
    }
    playAudio(prevIndex);
  };

  // Handle slider value change during seeking
  const handleSliderValueChange = (value: number) => {
    setIsSeeking(true);
    setPosition(value);
  };

  // Seek to the slider's value when sliding is complete
  const handleSlidingComplete = async (value: number) => {
    if (playbackInstance) {
      if (isPlaying) {
        await playbackInstance.playFromPositionAsync(value);
      } else {
        await playbackInstance.setPositionAsync(value);
      }
    }
    setIsSeeking(false);
  };

  // Helper to format milliseconds to minutes:seconds
  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text>Loading Music...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.loadingContainer}>
        <Text>No permission to access media library.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Music Library Page */}
      <Text style={styles.header}>Music Library</Text>
      <FlatList
        data={audioAssets}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <TouchableOpacity 
            style={styles.listItem} 
            onPress={() => playAudio(index)}
          >
            <Text style={styles.listItemText}>{item.filename}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Player Controls */}
      {currentTrackIndex !== -1 && (
        <View style={styles.playerContainer}>
          <Text style={styles.nowPlaying}>
            Now Playing: {audioAssets[currentTrackIndex].filename}
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration}
            value={position}
            minimumTrackTintColor="#1FB28A"
            maximumTrackTintColor="#d3d3d3"
            thumbTintColor="#1FB28A"
            onValueChange={handleSliderValueChange}
            onSlidingComplete={handleSlidingComplete}
          />
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
          <View style={styles.controls}>
            <TouchableOpacity onPress={handlePrevious} style={styles.controlButton}>
              <Text style={styles.controlText}>Previous</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePlayPause} style={styles.controlButton}>
              <Text style={styles.controlText}>{isPlaying ? 'Pause' : 'Play'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNext} style={styles.controlButton}>
              <Text style={styles.controlText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 40,
    paddingHorizontal: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center'
  },
  listItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderColor: '#ccc'
  },
  listItemText: {
    fontSize: 16,
  },
  playerContainer: {
    borderTopWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#f9f9f9'
  },
  nowPlaying: {
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center'
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  timeText: {
    fontSize: 14,
    color: '#555'
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  controlButton: {
    padding: 10,
    backgroundColor: '#1FB28A',
    borderRadius: 5,
  },
  controlText: {
    color: '#fff',
    fontSize: 16,
  }
});

export default App;
