import { memo } from "react"
import { View } from "react-native"
import { colors, space, type Color, type Space } from "@/theme/tokens"

type Props = {
  color?: Color;
  margin?: Space;
  height?: number;
}

const DividerBase = ({ color = colors.line, margin = space.lg, height = 2 }: Props) => {
  return (
    <View style={{ backgroundColor: color, marginVertical: margin, height }} />
  )
}


export const Divider = memo(DividerBase);
