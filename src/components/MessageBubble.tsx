import React from 'react';
import { Image, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { Colors } from '@/constants/theme';
import type { MessageType } from '@/types';

interface MessageBubbleProps {
  content: string;
  isOwn: boolean;
  timestamp: string; // ISO string
  senderName?: string;
  avatarUrl?: string;
  messageType?: MessageType;
}

export default function MessageBubble({
  content,
  isOwn,
  timestamp,
  senderName,
  avatarUrl,
  messageType = 'user',
}: MessageBubbleProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const formattedTime = (() => {
    try {
      const date = new Date(timestamp);
      const h = date.getHours().toString().padStart(2, '0');
      const m = date.getMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    } catch {
      return '';
    }
  })();

  const initial = senderName ? senderName[0].toUpperCase() : '?';

  if (messageType === 'system') {
    return (
      <View style={styles.systemRow}>
        <View
          style={[
            styles.systemBubble,
            { backgroundColor: colors.backgroundSelected },
          ]}
        >
          <Text style={[styles.systemContent, { color: colors.textSecondary }]}>
            {content}
          </Text>
        </View>
        <Text style={[styles.systemTimestamp, { color: colors.placeholder }]}>
          {formattedTime}
        </Text>
      </View>
    );
  }

  const avatar = (
    <View style={styles.avatarContainer}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      {!isOwn && avatar}

      <View style={[styles.bubbleColumn, !isOwn && styles.bubbleColumnOther]}>
        {senderName != null && senderName.length > 0 && (
          <Text style={[styles.senderName, { color: colors.textSecondary }]}>
            {senderName}
          </Text>
        )}
        <View
          style={[
            styles.bubble,
            isOwn
              ? [styles.bubbleOwn, { backgroundColor: '#1877F2' }]
              : [styles.bubbleOther, { backgroundColor: colors.backgroundElement }],
          ]}
        >
          <Text
            style={[
              styles.content,
              isOwn ? styles.contentOwn : { color: colors.text },
            ]}
          >
            {content}
          </Text>
        </View>
        <Text
          style={[
            styles.timestamp,
            isOwn ? styles.timestampOwn : styles.timestampOther,
          ]}
        >
          {formattedTime}
        </Text>
      </View>
      {isOwn && avatar}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 12,
    alignItems: 'flex-end',
    gap: 6,
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginBottom: 2,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1877F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  bubbleColumn: {
    maxWidth: '72%',
  },
  bubbleColumnOther: {
    // slight indent already provided by avatar
  },
  senderName: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  bubbleOwn: {
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    borderBottomLeftRadius: 4,
  },
  content: {
    fontSize: 15,
    lineHeight: 20,
  },
  contentOwn: {
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: 11,
    color: '#8A8D91',
    marginTop: 2,
  },
  timestampOwn: {
    textAlign: 'right',
    marginRight: 4,
  },
  timestampOther: {
    textAlign: 'left',
    marginLeft: 4,
  },
  systemRow: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  systemBubble: {
    maxWidth: '84%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  systemContent: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '500',
  },
  systemTimestamp: {
    fontSize: 10,
    marginTop: 3,
  },
});
