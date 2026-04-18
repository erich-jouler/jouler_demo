import React from 'react';

function About({ onBackToLanding }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50">
      <div className="container mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <div className="flex items-center justify-center mb-12">
            <img 
              src="/Jouler assets/jouler-logo-diamond.svg" 
              alt="Jouler" 
              className="h-80 w-auto max-w-3xl"
            />
          </div>
          <button
            onClick={onBackToLanding}
            className="mb-8 text-green-600 hover:text-green-700 font-medium flex items-center space-x-2 mx-auto"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
            </svg>
            <span>Back to Home</span>
          </button>
          
          <h1 className="text-5xl font-bold text-gray-900 mb-4">About</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Meet the team behind Jouler's thermal network M&V technology platform
          </p>
        </header>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="md:flex">
              <div className="md:w-1/2">
                <img
                  src="/E Headshot.jpg"
                  alt="Erich Ryan - CEO"
                  className="w-full h-96 md:h-full object-cover"
                />
              </div>
              <div className="md:w-1/2 p-8">
                <div className="text-center md:text-left">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Erich Ryan</h2>
                  <p className="text-xl text-green-600 font-semibold mb-4">CEO</p>
                  
                  <div className="flex justify-center md:justify-start mb-6">
                    <a
                      href="https://linkedin.com/in/erich-ryan"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 flex items-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z" clipRule="evenodd"/>
                      </svg>
                      <span>LinkedIn Profile</span>
                    </a>
                  </div>
                </div>

                <div className="space-y-4 text-gray-700">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Background</h3>
                    <p className="leading-relaxed">
                      Erich received his Master's in Mechanical Engineering from UMass Amherst, where he was the lead author on published research around the techno-economics of a district geothermal system in a campus setting. He has worked as a utility program evaluator with Verdant Associates, verifying savings calculations and contributing to evaluation reports across the electric utility sector, including the pilot SMUD All-Electric Home Program. He has also worked in the energy tech space, having been a core contributor to SnoFox Sciences, building digital twins to optimize energy consumption in cold storage facilities. He is highly excited by the development of TENs throughout the country, and is uniquely positioned to stack his academic and professional experience and help drive innovation for this nascent industry.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div className="mt-12 bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Our Mission</h2>
            <div className="max-w-3xl mx-auto text-center text-gray-700">
              <p className="text-lg mb-4">
                At Jouler, we're dedicated to advancing the deployment and optimization of thermal energy networks through comprehensive measurement & verification technology.
              </p>
              <p className="text-lg mb-6">
                Our platform enables utilities, developers, and communities to maximize the efficiency and economic value of thermal network investments while contributing to a more sustainable energy future.
              </p>
              <p className="text-lg font-medium text-green-600">
                Interested in talking TENs? Reach out to{' '}
                <a 
                  href="mailto:erich@jouler.net" 
                  className="underline hover:text-green-700 transition-colors"
                >
                  erich@jouler.net
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default About;