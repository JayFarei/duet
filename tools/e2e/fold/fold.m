// Folds or unfolds the iPhone Duo simulator from the command line, through SpringBoard's own display tool service
// (SBSDisplayToolService.swapDisplayWithSettings, the call behind Apple's internal `suiatool`). Build with build.sh,
// run with `xcrun simctl spawn <udid> fold.bin [-duration=<s>] [-position=closed|book|open] [-wait]`; no args swaps to the
// other display. Private API, simulator only, for the e2e harness.
#import <Foundation/Foundation.h>
#include <dlfcn.h>
typedef struct { long long a; double b; long long c; long long d; BOOL e; long long f; double g; double h; } Swap;
@interface NSObject (Tool)
- (void)swapDisplayWithSettings:(Swap)s completion:(void (^)(void))done;
- (void)unlockForTestingWithCompletion:(void (^)(void))done;
- (void)invalidate;
@end
int main(int argc, char **argv) { @autoreleasepool {
  void *f = dlopen("/System/Library/PrivateFrameworks/SpringBoardFoundation.framework/SpringBoardFoundation", RTLD_NOW);
  dlopen("/System/Library/PrivateFrameworks/SpringBoardServices.framework/SpringBoardServices", RTLD_NOW);
  BOOL (*parse)(NSArray *, void *, NSError **) = dlsym(f, "SBFDisplayToolSwapSettingsFromArguments");
  NSString *(*usage)(void) = dlsym(f, "SBFDisplayToolSwapSettingsUsageDescription");
  Class svc = NSClassFromString(@"SBSDisplayToolService");
  if (!parse || !svc) { fprintf(stderr, "fold: display tool API not found in this runtime\n"); return 2; }
  NSMutableArray *args = [NSMutableArray array];
  BOOL unlock = NO;
  for (int i = 1; i < argc; i++) {
    NSString *a = @(argv[i]);
    if ([a isEqual:@"-h"] || [a isEqual:@"--help"]) { printf("%s\n", usage().UTF8String); return 0; }
    if ([a isEqual:@"-unlock"]) { unlock = YES; continue; }
    [args addObject:a];
  }
  id tool = [svc new];
  dispatch_semaphore_t sem = dispatch_semaphore_create(0);
  if (unlock) {
    [tool unlockForTestingWithCompletion:^{ dispatch_semaphore_signal(sem); }];
  } else {
    unsigned char buf[512] = {0}; NSError *perr = nil;
    if (!parse(args, buf, &perr)) { fprintf(stderr, "fold: %s\n", perr.description.UTF8String); return 64; }
    Swap s; memcpy(&s, buf, sizeof s);
    [tool swapDisplayWithSettings:s completion:^{ dispatch_semaphore_signal(sem); }];
  }
  if (dispatch_semaphore_wait(sem, dispatch_time(DISPATCH_TIME_NOW, 30 * NSEC_PER_SEC))) { fprintf(stderr, "fold: timed out\n"); [tool invalidate]; return 3; }
  [tool invalidate];
  return 0;
}}
