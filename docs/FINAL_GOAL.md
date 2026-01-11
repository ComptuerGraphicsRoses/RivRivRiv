BBM 412 - COMPUTER GRAPHICS – 2025 FALL

TERM PROJECT GUIDE

As your term project, you and your teammates will develop a WebGL game on the given theme.

This semester’s theme is: AI & Games – Learning to Play

Genre/Mechanic is Flocking Frenzy – Implement boids (flocking algorithm) where the player can disrupt or guide a flock’s movement.

The minimum CG requirements that every submitted project MUST meet:

In addition to the requirements given above, every submitted project must also meet the minimum CG criteria given as follows.

The project is realized in WebGL2.x using Javascript, GLSL and HTML. You need to produce your own code. You must NOT use game engines (such as Unity) to produce your WebGL application.
The project is realized completely in 3D (not in 2D or 2.5D). You are free to use perspective or parallel projection (or both, by enabling the option to switch between the two) for 3D viewing.
The game must incorporate a scoring scheme and show the current score during the game.
The user is able to translate and rotate the camera in 3 dimensions (6 DOF in total).
There are at least 3 different objects in different morphologies (~shapes). For example, {apple, pear, banana} or {car, truck, motorcycle} are groups of objects with elements in varying morphologies.
At least 3 objects (again in different morphologies) (may be the same objects as above) should be logically movable (e.g. one of these objects should not be a wall), and can be selected, translated and rotated freely in 3 dimensions by the user. Selection of the objects can be done by mouse picking, keyboard key, interface, touch control, joystick, chopstick, wizard’s staff or telekinesis. The last three get bonus points.
There must be at least one spotlight (it can be turned off at the beginning if you want). The user will be able to translate and rotate this spotlight in 3 dimensions (6 DOF in total) freely and turn it on/off anytime. The strength (intensity) of the spotlight can be adjusted as desired by the user.
Axis selection of the translations and rotations of the camera, objects and the light source can be done by keyboard buttons or via a user interface.
At least 2 different types of shading should be implemented using at least 2 shader programs with different pairs of vertex and fragment shaders. These 2 shader programs MUST be implemented by the project group and their GLSL source codes must exist as separate text files (at least 1 vertex and 1 fragment shader source file for each shader program >> at least 4 GLSL files in total). The user should be able to switch between the different shading options at any time. Please also note that these 2 shader programs should have significantly different shader code pairs (vertex+fragment) and have significantly different effects on the rendered scene. In other words, the difference between the resulting renderings of the two programs should NOT be trivial.
The two mandatory shader sets must modify the entire rendered view captured by the camera, not just specific parts or objects.
To better understand this requirement, please refer to the example from a previous year's project here: YouTube Link.
Of course, additional shaders can act on only the specific parts/objects in the scene.
Distinctly Different Outputs: The two mandatory shader sets should produce significantly different visual effects. Again, the example above is an excellent illustration of this point.
You must include your shader codes (at least 2 pairs) in your presentation and explain them (their mechanism) briefly.
In a separate part of the main 3D scene, the names of the project group members are assembled using 3D objects that are congruent with the selected project. Using a keyboard shortcut, the camera will move (not teleport) to this part of the scene to show the names from a top-down view.  Then, using the same shortcut, the camera will return to where it was before.
Pressing h/H will bring up the help menu, which describes all the shortcuts and how to use the application in detail. Pressing h/H again will hide the menu.
 

A project that satisfies all of the requirements above will start with a 40 points final demo base score out of 100.


In addition to this base score,

- finalizing the project successfully as detailed in the proposal document,

- extra features,

- high quality and appealing scene/environment design,

- level of organization and task distribution among the project group,

- presentation skills and the quality of the submitted presentation document,

will raise the score up to 100 points (and beyond).

 

Term project breakdown:

--Project Proposal: 10%

--Final Presentation + Final Demo: 85%

Minimum CG Requirements (40%)
Fair Share of The Presentation Time between All Group Members, Members' Individual Depth of Knowledge of the Project's Details and Ability to Answer Any Question Regarding the Project, Presentation Delivery and Elocution, Overall Quality of the Presentation, Effective Use of Time (15%)
Demo Quality + Additional Overall CG Quality Score (25%)
Advanced CG Features (that Excel Beyond Regular Additional Quality)  (20%) e.g., using tessellation or geometry shaders, employing advanced features that have not been implemented in 414 experiments such as reflection mapping, bump mapping, transparency, particle systems, hierarchical modeling, procedural animation, physics simulation, fluid simulation, wind simulation and so on..
--Demo Video (Teaser/Trailer): 15%

How Informative The Video is about the Project (50%) i.e., describing the project features using narration and/or text/captions
Video Sound and Image Quality (25%) hoping for 4K Dolby Digital but will settle for 720p+ stereo
Game-Trailer-likeness (25%)


NOTE:

You may make use of resources such as books, websites, sample codes on the web etc. by explicitly referencing each resource at the presentation.
However, if the submitted project is a duplicate (or a modified version) of a previous work by others or the group's own members, members of the project group will fail the class and be reported for disciplinary action.
 

At project delivery:

- a directory containing the presentation document (ppt, pptx or pdf file) and the demo video.

- the entire Netbeans project directory (cleaned from unnecessary files).

(2 separate directories in total) must be compressed together as a single ZIP or RAR file and submitted to the online system before the submission deadline.

 

Final presentations will take place during the 2nd week of the finals period.

 

As long as your project meets all the minimum requirements,

You may make use of any (yes any!) external library you want to use. But you must mention the references for those external libraries in your final presentation.
You may make use of any external model, texture, animation...made by a third party. However, making your own models, animations, textures etc. using blender, maya, gimp, photoshock… will gain more Additional Overall Quality score.
This is why project groups need to be meticulous about shaping project aspects. You should also mind that you need to create and use your own vertex+fragment shaders or everything goes to bust, i.e., 0.