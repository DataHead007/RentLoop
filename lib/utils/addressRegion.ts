/**
 * 从常见中国大陆文本地址中解析「省 / 直辖市 + 地级市」用于列表展示（启发式，非行政区划校验）。
 */
export function formatProvinceCityLine(address: string | null | undefined): string {
  const s = address?.trim()
  if (!s) return ''

  // 直辖市：北京市 / 上海市 …
  const zx = /^(北京|上海|天津|重庆)市/.exec(s)
  if (zx) {
    return `${zx[1]}市`
  }

  // 省、自治区、特别行政区 + 地级「XX市 / XX州 / XX盟」
  const provRe = /^(.+?(?:省|自治区|特别行政区))/
  const pm = provRe.exec(s)
  if (pm) {
    const province = pm[1]
    const rest = s.slice(pm[0].length)
    const cityRe = /^(.+?(?:市|州|盟))/
    const cm = cityRe.exec(rest)
    if (cm) {
      const city = cm[1]
      if (city === province) return province
      return `${province} · ${city}`
    }
    return province
  }

  // 无省级前缀时取首个「XX市」
  const cityOnly = /^(.+?市)/.exec(s)
  if (cityOnly) {
    return cityOnly[1]
  }

  return ''
}
