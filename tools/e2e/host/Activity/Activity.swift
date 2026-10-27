import ActivityKit
import SwiftUI
import WidgetKit

@main struct Activities: WidgetBundle {
  var body: some Widget { MusicActivity() }
}

struct Art: View {
  var size: CGFloat
  var body: some View {
    RoundedRectangle(cornerRadius: size * 0.22)
      .fill(LinearGradient(colors: [.pink, .orange, .purple], startPoint: .topLeading, endPoint: .bottomTrailing))
      .frame(width: size, height: size)
  }
}

struct Meter: View {
  var body: some View {
    HStack(spacing: 2) {
      ForEach([0.5, 0.9, 0.6, 1.0, 0.4], id: \.self) { h in
        Capsule().fill(.pink).frame(width: 3, height: 14 * h)
      }
    }.frame(height: 14)
  }
}

struct MusicActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: MusicAttributes.self) { ctx in
      HStack(spacing: 12) {
        Art(size: 44)
        VStack(alignment: .leading) {
          Text(ctx.state.title).font(.headline)
          Text(ctx.state.artist).font(.subheadline).foregroundStyle(.secondary)
        }
        Spacer()
        Meter()
      }.padding()
    } dynamicIsland: { ctx in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) { Art(size: 52) }
        DynamicIslandExpandedRegion(.trailing) { Meter() }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading) {
            Text(ctx.state.title).font(.headline)
            Text(ctx.state.artist).font(.subheadline).foregroundStyle(.secondary)
          }
        }
      } compactLeading: {
        Art(size: 22)
      } compactTrailing: {
        Meter()
      } minimal: {
        Art(size: 20)
      }
    }
  }
}
