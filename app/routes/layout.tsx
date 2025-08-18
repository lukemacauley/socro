import { useAuth } from "@workos-inc/authkit-react";
import { Authenticated, Unauthenticated } from "convex/react";
import { Link, Outlet, useNavigate, useLocation } from "react-router";
import { AppSidebar } from "~/components/app-sidebar";
import { Button } from "~/components/ui/button";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";
import { MeshGradient, DotGrid } from "@paper-design/shaders-react";
import { Input } from "~/components/ui/input";

export default function Layout() {
  const { signIn, signUp, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!isLoading && !user && pathname !== "/") {
    navigate("/");
  }

  return (
    <TooltipProvider>
      <Unauthenticated>
        <div className="fixed top-0 inset-x-0 z-50 w-full">
          <div className="flex items-center bg-primary-foreground justify-between py-4 px-4 sm:px-0 max-w-screen-xl w-full mx-auto">
            <div className="">
              <Link to="/">
                <img src="/socro-logo.svg" alt="Socro Logo" className="h-7.5" />
              </Link>
            </div>
            <div className=" flex items-center gap-2">
              <Button variant="outline" onClick={() => signIn()}>
                Sign In
              </Button>
              <Button asChild>
                <Link to="mailto:contact@socro.ai">Book a Demo</Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="max-w-screen-xl mx-auto flex flex-col px-4 sm:px-0 gap-12 md:gap-20 mb-20">
          <div className="pt-40 sm:pt-88">
            <h1 className="text-3xl max-w-5xl text-pretty md:text-5xl leading-tight">
              Develop the strategic thinking and judgment that make senior
              partners irreplaceable.
            </h1>
          </div>
          <div className="relative">
            <MeshGradient
              colors={["#dad9d4", "#535146", "#c96442", "#ede9de"]}
              distortion={1}
              swirl={0.8}
              speed={0.1}
              style={{ width: "100%", height: "800px" }}
            />
            <picture>
              <source media="(max-width: 768px)" srcSet="/hero-mobile.png" />
              <source media="(min-width: 769px)" srcSet="/hero.png" />
              <img
                src="/hero.png"
                alt="Socro Hero"
                className="w-4/5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              />
            </picture>
          </div>
          <div className="max-w-5xl mx-auto flex flex-col gap-10 py-20">
            <p className="text-3xl text-pretty md:text-5xl leading-tight">
              Socro develops the analytical skills your associates need through
              real-world scenarios and guided questioning.
            </p>
            <p className="text-3xl text-pretty md:text-5xl leading-tight">
              While AI automates the predictable, your lawyers learn to navigate
              the complex, ambiguous problems that make or break client
              relationships.
            </p>
            <p className="text-3xl text-pretty md:text-5xl leading-tight">
              Better thinkers become better partners. And better partners build
              better firms.
            </p>
          </div>

          {/* <div className="bg-card rounded-xl border border-border">
            <main className="px-6 lg:px-12">
              <div className="max-w-7xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center py-12 lg:py-20">
                  <div className="space-y-8">
                    <div className="space-y-6">
                      <h1 className="text-3xl lg:text-4xl">
                        Built on legal excellence
                      </h1>
                      <p className="text-lg max-w-md text-muted-foreground">
                        Your associates train on scenarios developed with
                        Halsbury's Law. This isn't generic check-a-box training,
                        it's rigorous UK legal thinking that directly translates
                        to better client advice.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-12 py-12 lg:py-20 border-t border-border">
                  <div className="space-y-4">
                    <h3 className="font-medium">
                      Scenarios from your practice areas
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Real legal challenges drawn from current UK case law that
                      mirror the complexities your team faces daily
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium">Reduce supervision time</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Associates arrive at your door with sharper instincts,
                      better questions, and fewer basic errors
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium">Consistency across the firm</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Every lawyer develops using the same authoritative
                      foundation—creating a unified standard of excellence
                    </p>
                  </div>
                </div>
              </div>
            </main>
          </div> 
           <div className="bg-card rounded-xl border border-border">
            <main className="px-6 lg:px-12">
              <div className="max-w-7xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center py-12 lg:py-20">
                  <div className="space-y-8">
                    <div className="space-y-6">
                      <h1 className="text-3xl lg:text-4xl">
                        Performance that's measurable
                      </h1>
                      <p className="text-lg max-w-md text-muted-foreground">
                        See exactly how your associates think through problems
                        across five critical dimensions: depth of reasoning,
                        creative approach, perspective analysis, principle
                        application, and consequence identification. Finally,
                        data on who's ready for client-facing work and who needs
                        development.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-12 py-12 lg:py-20 border-t border-border">
                  <div className="space-y-4">
                    <h3 className="font-medium">
                      Identify your future partners early
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Spot which associates think strategically versus those who
                      just process information
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium">Benchmark across teams</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Compare development between practice areas and identify
                      where targeted training is needed
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium">ROI you can measure</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Track progression from basic analysis to partnership-level
                      thinking—justify every training pound spent
                    </p>
                  </div>
                </div>
              </div>
            </main>
          </div>
          */}
          <div className="relative">
            <MeshGradient
              colors={["#535146", "#83827d", "#28261b"]}
              distortion={1}
              swirl={0.8}
              speed={0.1}
              style={{ width: "100%", height: "500px" }}
            />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="max-w-3xl w-full">
                <h3 className="text-xl md:text-3xl text-center text-pretty text-white">
                  Let’s connect you with a Socro expert.
                  <br />
                  See the full power of Socro in 30 minutes.
                </h3>
                <div className="flex flex-col md:flex-row items-center gap-2 mt-10">
                  <Input
                    className="!bg-primary-foreground h-12 sm:h-16 text-xl sm:!text-2xl"
                    placeholder="Enter your email"
                  />
                  <Button
                    size="lg"
                    className="h-12 sm:h-16 w-full sm:w-auto text-xl sm:text-2xl"
                    variant="secondary"
                  >
                    Book a demo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <Outlet />
          </SidebarInset>
        </SidebarProvider>
      </Authenticated>
    </TooltipProvider>
  );
}
