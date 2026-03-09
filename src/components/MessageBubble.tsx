import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';

interface MessageBubbleProps {
  content: string;
  isOwn: boolean;
  timestamp: string; // ISO string
  senderName?: string; // shown for non-own messages
}

export default function MessageBubble({
  content,
  isOwn,
  timestamp,
  senderName,
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

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      <View style={styles.bubbleColumn}>
        {!isOwn && senderName != null && senderName.length > 0 && (
          <Text style={[styles.senderName, { color: colors.textSecondary }]}>
            {senderName}
          </Text>
        )}
        <View
          style={[
            styles.bubble,
            isOwn
              ? [styles.bubbleOwn, { backgroundColor: '#208AEF' }]
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 12,
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  bubbleColumn: {
    maxWidth: '75%',
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
    color: '#ffffff',
  },
  timestamp: {
    fontSize: 11,
    color: '#9CA3AF',
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
});
