import { BrandColors } from '@/constants/theme';
import { Eye, EyeOff, Lock, LucideIcon, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface UserInputFieldProps {
  title: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  leftIcon?: LucideIcon;
}

export default function UserInputField({ 
  title, 
  placeholder, 
  value, 
  onChangeText, 
  secureTextEntry = false, 
  keyboardType,
  leftIcon: LeftIconComponent 
}: UserInputFieldProps) {
  const [isPasswordHidden, setIsPasswordHidden] = useState(secureTextEntry);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.contentWrapper}>
      <Text style={styles.label}>{title}</Text>
      
      <View style={styles.inputContainer}>
        {LeftIconComponent && (
          <View style={styles.leftIconContainer}>
            <LeftIconComponent size={18} color={BrandColors.secondary} />
          </View>
        )}

        <TextInput 
          style={[
            styles.fieldStyle, 
            isFocused && styles.fieldStyleFocused,
            LeftIconComponent ? styles.fieldWithLeftIcon : null, 
            secureTextEntry ? styles.fieldWithRightIcon : null
          ]}
          editable={true}
          placeholder={placeholder}
          placeholderTextColor={BrandColors.secondary}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPasswordHidden}
          keyboardType={keyboardType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />

        {secureTextEntry && (
          <Pressable 
            onPress={() => setIsPasswordHidden(!isPasswordHidden)} 
            style={styles.rightIconContainer}
            hitSlop={8}
          >
            {isPasswordHidden ? (
              <EyeOff size={18} color={BrandColors.secondary} />
            ) : (
              <Eye size={18} color={BrandColors.secondary} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function EmailField({ title, placeholder, value, onChangeText }: UserInputFieldProps) {
  return (
    <UserInputField 
      title={title}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      keyboardType="email-address"
      leftIcon={Mail}
    />
  );
}

export function TextField({ title, placeholder, value, onChangeText, keyboardType = 'default' }: UserInputFieldProps) {
  return (
    <UserInputField
      title={title}
      placeholder={placeholder} 
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
    />
  );
}

export function TextfieldLeftIcon({ title, placeholder, value, leftIcon, onChangeText }: UserInputFieldProps) {
  return (
    <UserInputField
      title={title}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      leftIcon={leftIcon}
    />
  );
}

export function PasswordField({ title, placeholder, value, onChangeText }: UserInputFieldProps) {
  return (
    <UserInputField
      title={title}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={true}
      leftIcon={Lock}
    />
  );
}

const styles = StyleSheet.create({
  contentWrapper: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: BrandColors.primary,
    marginBottom: 6,
    fontFamily: "PlusJakartaSans-Bold",
  },
  inputContainer: {
    position: 'relative',
    width: '100%',
    justifyContent: 'center',
  },
  fieldText: {
    fontFamily: "PlusJakartaSans-Regular",
  },
  leftIconContainer: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  rightIconContainer: {
    position: 'absolute',
    right: 12,
    zIndex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldStyle: {
    backgroundColor: BrandColors.inputField,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: BrandColors.primary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fieldStyleFocused: {
    borderColor: BrandColors.primary,
  },
  fieldWithLeftIcon: {
    paddingLeft: 40,
  },
  fieldWithRightIcon: {
    paddingRight: 40,
  },
});