import React from 'react';
import { Linking, StyleSheet, Text, TextStyle, StyleProp } from 'react-native';

interface HyperlinkTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
}

export const HyperlinkText: React.FC<HyperlinkTextProps> = ({ text, style }) => {
  // Regular expressions to match email addresses and websites
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const websiteRegex = /(www\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  
  const handlePress = (url: string) => {
    let formattedUrl = url;
    
    // Add mailto: if it's an email address
    if (emailRegex.test(url)) {
      formattedUrl = `mailto:${url}`;
    }
    // Add https:// if it's a website without protocol
    else if (url.startsWith('www.')) {
      formattedUrl = `https://${url}`;
    }
    
    Linking.openURL(formattedUrl).catch(err => 
      console.error('Failed to open URL:', err)
    );
  };

  const renderText = () => {
    if (!text) return null;

    // Split text by email and website patterns
    const parts = text.split(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|www\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
    
    return parts.map((part, index) => {
      if (emailRegex.test(part) || websiteRegex.test(part)) {
        return (
          <Text
            key={index}
            style={[style, styles.hyperlink]}
            onPress={() => handlePress(part)}
          >
            {part}
          </Text>
        );
      }
      return (
        <Text key={index} style={style}>
          {part}
        </Text>
      );
    });
  };

  return <Text style={style}>{renderText()}</Text>;
};

const styles = StyleSheet.create({
  hyperlink: {
    color: '#22C55E', // Dark green color
    textDecorationLine: 'underline',
  },
});
