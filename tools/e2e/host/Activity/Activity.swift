import ActivityKit
import SwiftUI
import WidgetKit

@main struct Activities: WidgetBundle {
  var body: some Widget { MusicActivity(); TimerActivity() }
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

struct Countdown: View {
  var end: Date
  var body: some View {
    Text(timerInterval: Date.now...max(end, .now), countsDown: true).monospacedDigit().foregroundStyle(.orange)
  }
}

struct TimerActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TimerAttributes.self) { ctx in
      HStack(spacing: 12) {
        Image(systemName: "timer").font(.title).foregroundStyle(.orange)
        Text(ctx.attributes.name).font(.headline)
        Spacer()
        Countdown(end: ctx.state.end).font(.title2)
      }.padding()
    } dynamicIsland: { ctx in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) { Image(systemName: "timer").font(.title).foregroundStyle(.orange) }
        DynamicIslandExpandedRegion(.trailing) { Countdown(end: ctx.state.end).font(.title2).frame(width: 80) }
        DynamicIslandExpandedRegion(.bottom) { Text(ctx.attributes.name).font(.headline) }
      } compactLeading: {
        Image(systemName: "timer").foregroundStyle(.orange)
      } compactTrailing: {
        Countdown(end: ctx.state.end).frame(width: 44)
      } minimal: {
        Image(systemName: "timer").foregroundStyle(.orange)
      }
    }
  }
}
